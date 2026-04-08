import { ESLint } from "eslint";
import plugin from "../src/index.ts";
import { js } from "./rule-tester.js";
import assert from "assert";

// Sanity check that runs the recommended config
// on common + valid real-world code, as opposed to contrived test cases.
describe("recommended rules on real-world code", () => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [plugin.configs.recommended],
  });

  describe("should not flag", () => {
    [
      {
        name: "useLayoutEffect",
        code: js`
          function Input({ count }) {
            const ref = useRef();

            useLayoutEffect(() => {
              if (count == 0) {
                ref.current?.focus();
              }
            }, [count]);

            return (
              <input ref={ref} value={count} />
            )
          }
        `,
      },
      {
        name: "Managing a timer",
        code: js`
        function Timer() {
          const [seconds, setSeconds] = useState(0);

          useEffect(() => {
            const interval = setInterval(() => {
              setSeconds((s) => s + 1);
            }, 1000);

            return () => { 
              clearInterval(interval); 
            }
          }, []);

          return <div>{seconds}</div>;
        }
      `,
      },
      {
        name: "Debouncing",
        code: js`
          function useDebouncedState(value, delay) {
            const [state, setState] = useState(value);
            const [debouncedState, setDebouncedState] = useState(value);

            useEffect(() => {
              const timeout = setTimeout(() => {
                setDebouncedState(state);
              }, delay);

              return () => {
                clearTimeout(timeout);
              };
            }, [delay, state]);

            return [state, debouncedState, setState];
          }
        `,
      },
      {
        // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/62
        name: "Debouncing via Lodash",
        code: js`
          import { useState, useEffect } from 'react';
          import debounce from 'lodash/debounce';

          export const useDebouncedState = (delay) => {
            const [value] = useState(0);

            const debouncedFunction = debounce((newValue) => {
              console.log(newValue);
            }, delay);

            useEffect(() => {
              debouncedFunction(value);
            }, [value, debouncedFunction]);

            return [];
          };
        `,
      },
      {
        name: "Listening for window events",
        code: js`
        function WindowSize() {
          const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

          useEffect(() => {
            const handleResize = () => {
              setSize({ width: window.innerWidth, height: window.innerHeight });
            };

            window.addEventListener('resize', handleResize);

            return () => {
              window.removeEventListener('resize', handleResize);
            };
          }, []);

          return <div>{size.width} x {size.height}</div>;
        }
      `,
      },
      {
        // https://github.com/NickvanDyke/eslint-plugin-react-you-might-not-need-an-effect/issues/24
        name: "ResizeObserver",
        code: js`
          function useHasOverflow({ contentRef, maxHeight }) {
            const [hasOverflow, setHasOverflow] = useState(false);

            useEffect(() => {
              const resizeObserver = new ResizeObserver((element) => {
                const hasContentOverflow = element.scrollHeight > maxHeight;
                setHasOverflow(hasContentOverflow);
              })

              if (contentRef.current != null) {
                resizeObserver.observe(contentRef.current);
              }

              return () => {
                resizeObserver.disconnect();
              };
            }, [contentRef, maxHeight]);

            return hasOverflow;
          }
        `,
      },
      {
        name: "Play/pausing DOM video",
        code: js`
        function VideoPlayer() {
          const [isPlaying, setIsPlaying] = useState(false);
          const videoRef = useRef();

          useEffect(() => {
            if (isPlaying) {
              videoRef.current.play();
            } else {
              videoRef.current.pause();
            }
          }, [isPlaying]);

          return <div>
            <video ref={videoRef} />
            <button onClick={() => setIsPlaying((p) => !p)} />
          </div>
        }
      `,
      },
      {
        name: "Saving to LocalStorage",
        code: js`
        function Notes() {
          const [notes, setNotes] = useState(() => {
            const savedNotes = localStorage.getItem('notes');
            return savedNotes ? JSON.parse(savedNotes) : [];
          });

          useEffect(() => {
            localStorage.setItem('notes', JSON.stringify(notes));
          }, [notes]);

          return <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        }
      `,
      },
      {
        name: "Logging/Analytics",
        code: js`
        function Nav() {
          const [page, setPage] = useState('home');

          useEffect(() => {
            console.log("page viewed", page);
          }, [page]);

          return (
            <div>
              <button onClick={() => setPage('home')}>Home</button>
              <button onClick={() => setPage('about')}>About</button>
              <div>{page}</div>
            </div>
          )
        }
      `,
      },
      {
        name: "CountryPicker",
        code: js`
        function CountryPicker({ withEmoji }) {
          const { translation, getCountries } = useContext();

          const [state, setState] = useState({
            countries: [],
            selectedCountry: null,
          });
          const setCountries = (countries) => setState({ ...state, countries });

          useEffect(() => {
            let cancel = false;
            getCountries(translation)
              .then((countries) => (cancel ? null : setCountries(countries)))
              .catch(console.warn);

            return () => {
              cancel = true;
            };
          }, [translation, withEmoji]);
        }
      `,
      },
      {
        name: "navigation.setOptions",
        code: js`
        import { useNavigation } from '@react-navigation/native';
        import { useState, useLayoutEffect } from 'react';

        function ProfileScreen({ route }) {
          const navigation = useNavigation();
          const [value, onChangeText] = React.useState(route.params.title);

          React.useLayoutEffect(() => {
            navigation.setOptions({
              title: value === '' ? 'No title' : value,
            });
          }, [navigation, route]);
        }
      `,
      },
      {
        name: "Keyboard state listener",
        code: js`
        import { useEffect, useState } from 'react';
        import keyboardReducer from './reducers';

        let globalKeyboardState = {
          recentlyUsed: []
        };

        export const keyboardStateListeners = new Set();

        const setKeyboardState = (action) => {
          globalKeyboardState = keyboardReducer(globalKeyboardState, action);
          keyboardStateListeners.forEach((listener) => listener(globalKeyboardState));
        };

        export const useKeyboardStore = () => {
          const [keyboardState, setState] = useState(globalKeyboardState);

          useEffect(() => {
            const listener = () => setState(globalKeyboardState);
            keyboardStateListeners.add(listener);
            return () => {
              keyboardStateListeners.delete(listener);
            };
          }, [keyboardState]);

          return { keyboardState, setKeyboardState };
        };

        useKeyboardStore.setKeyboardState = setKeyboardState;
      `,
      },
      {
        // https://github.com/NickvanDyke/eslint-plugin-react-you-might-not-need-an-effect/issues/28
        name: "Indexing ref state with internal state",
        code: js`
          import { useEffect, useRef, useState } from "react";

          const someArray = [{ id: 1 }, { id: 2 }, { id: 3 }];

          const Component = ({ value }) => {
            const inputRefs = useRef([]);

            useEffect(() => {
              inputRefs.current?.[index]?.focus();
            }, [value, index]);

            return (
              <>
                {someArray.map((item, index) => (
                  <input
                    key={item.id}
                    ref={(el) => (inputRefs.current[index] = el)}
                  />
                ))}
              </>
            )
          }
        `,
      },
      {
        // https://github.com/NickvanDyke/eslint-plugin-react-you-might-not-need-an-effect/issues/30
        name: "Ref callback",
        code: js`
          export const useOnScreen = () => {
              const [element, setElement] = useState(null);
              const [isIntersecting, setIntersecting] = useState(false);

              const ref = useCallback((element) => {
                  setElement(element);
              }, []);

              useEffect(() => {
                  if (!element) {
                      return;
                  }

                  const observer = new IntersectionObserver(([entry]) => {
                      setIntersecting(entry?.isIntersecting ?? false);
                  });

                  observer.observe(element);
                  return () => {
                      observer.disconnect();
                  };
              }, [element]);

              return { ref, isIntersecting };
          };
        `,
      },
      {
        // https://github.com/NickvanDyke/eslint-plugin-react-you-might-not-need-an-effect/issues/49
        name: "Effect with recursion",
        code: js`
        function Component() {
          useEffect(() => {
            const container = ctnDom.current
            if (!container) return

            // WebGL setup (~30 lines)
            const renderer = new Renderer({ alpha: true, premultipliedAlpha: false })
            const gl = renderer.gl
            const program = new Program(gl, {
              vertex: vert,
              fragment: frag,
              uniforms: {
                iTime: { value: 0 },
                iResolution: { value: new Vec3(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height) },
                hue: { value: hue },
                hover: { value: 0 },
                rot: { value: 0 },
                hoverIntensity: { value: hoverIntensity },
              },
            })
            const mesh = new Mesh(gl, { geometry, program })

            // Nested function 4: animation loop with recursion
            let rafId
            let lastTime = 0
            let currentRot = 0
            const rotationSpeed = 0.3

            const update = (t) => {
              rafId = requestAnimationFrame(update) // Recursive call
              const dt = (t - lastTime) * 0.001
              lastTime = t
              const currentTime = t * 0.001
              program.uniforms.iTime.value = currentTime

              // Color cycle
              if (cycleHue) {
                const cyclicHue = (hue + currentTime * hueCycleSpeed) % 360
                program.uniforms.hue.value = cyclicHue
              } else {
                program.uniforms.hue.value = hue
              }

              program.uniforms.hoverIntensity.value = hoverIntensity

              const effectiveHover = forceHoverState ? 1 : targetHover
              program.uniforms.hover.value += (effectiveHover - program.uniforms.hover.value) * 0.1

              if (rotateOnHover && effectiveHover > 0.5) {
                currentRot += dt * rotationSpeed
              }
              program.uniforms.rot.value = currentRot

              renderer.render({ scene: mesh })
            }
            rafId = requestAnimationFrame(update)

            // Cleanup function
            return () => {
              cancelAnimationFrame(rafId)
              window.removeEventListener("resize", resize)
              container.removeEventListener("mousemove", handleMouseMove)
              container.removeEventListener("mouseleave", handleMouseLeave)
              container.removeChild(gl.canvas)
              gl.getExtension("WEBGL_lose_context")?.loseContext()
            }
          }, [
            hue,
            hoverIntensity,
            rotateOnHover,
            forceHoverState,
            cycleHue,
            hueCycleSpeed,
            size,
          ])
        }
      `,
      },
      {
        // https://github.com/NickvanDyke/eslint-plugin-react-you-might-not-need-an-effect/issues/57
        name: "TanStack useInfinityQuery useInView",
        code: js`
          import React from 'react'
          import { useInView } from 'react-intersection-observer'
          import { useInfiniteQuery } from '@tanstack/react-query'

          function Example() {
            const { ref, inView } = useInView()

            const {
              status,
              data,
              error,
              isFetching,
              isFetchingNextPage,
              isFetchingPreviousPage,
              fetchNextPage,
              fetchPreviousPage,
              hasNextPage,
              hasPreviousPage,
            } = useInfiniteQuery({
              queryKey: ['projects'],
              queryFn: async ({
                pageParam,
              }) => {
                const response = await fetch('/api/projects?cursor=' + pageParam)
                return await response.json()
              },
              initialPageParam: 0,
              getPreviousPageParam: (firstPage) => firstPage.previousId,
              getNextPageParam: (lastPage) => lastPage.nextId,
            })

            React.useEffect(() => {
              if (inView && hasNextPage && !isFetchingNextPage) {
                fetchNextPage()
              }
            }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])
          }
        `,
      },
      {
        // https://github.com/NickvanDyke/eslint-plugin-react-you-might-not-need-an-effect/issues/57
        name: "TanStack useInfinityQuery useInView with state, prop and data in queryKey",
        code: js`
          import React from 'react'
          import { useInView } from 'react-intersection-observer'
          import { useInfiniteQuery } from '@tanstack/react-query'

          function Example(props) {
            const { ref, inView } = useInView()
            const [state] = React.useState(0)
            const search = useSearchParams()

            const {
              status,
              data,
              error,
              isFetching,
              isFetchingNextPage,
              isFetchingPreviousPage,
              fetchNextPage,
              fetchPreviousPage,
              hasNextPage,
              hasPreviousPage,
            } = useInfiniteQuery({
              // Makes the plugin interpret fetchNextPage as a state/prop/data function
              queryKey: ['projects', state, props, search],
              queryFn: async ({
                pageParam,
              }) => {
                const response = await fetch('/api/projects?cursor=' + pageParam)
                return await response.json()
              },
              initialPageParam: 0,
              getPreviousPageParam: (firstPage) => firstPage.previousId,
              getNextPageParam: (lastPage) => lastPage.nextId,
            })

            React.useEffect(() => {
              // TODO: Should maybe ideally also not flag no-event-handler here?
              // if (inView && hasNextPage && !isFetchingNextPage) {
                // Must have "void" so we can infer it's an async function
                void fetchNextPage()
              // }
            }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])
          }
        `,
      },
    ].forEach(({ name, code }) => {
      it(name, async () => {
        const results = await eslint.lintText(code);
        const messages = results[0].messages;
        assert.strictEqual(
          messages.length,
          0,
          `Expected no lint errors for: ${name}, but got: ${JSON.stringify(messages)}`,
        );
      });
    });
  });
});
