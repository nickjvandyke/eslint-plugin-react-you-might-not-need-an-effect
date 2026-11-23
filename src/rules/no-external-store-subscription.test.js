import { RuleTester } from "eslint";
import plugin from "../index.ts";
const js = String.raw;

const error = (messageId, data) => [{ messageId, data }];

import rule from "./no-external-store-subscription.ts";

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "no-external-store-subscription",
  rule,
  {
    valid: [
      {
        name: "No useEffect",
        code: js`
        function C() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `,
      },
      {
        name: "useEffect without cleanup, no state setter",
        code: js`
        function C() {
          useEffect(() => {
            console.log('hello');
          }, []);
        }
      `,
      },
      {
        name: "useEffect without cleanup, with state setter",
        code: js`
        function C() {
          const [count, setCount] = useState(0);
          useEffect(() => {
            setCount(1);
          }, []);
        }
      `,
      },
      {
        name: "useEffect with cleanup but no synchronous state setter (setter only in callback)",
        code: js`
        function C() {
          const [value, setValue] = useState(0);
          useEffect(() => {
            const timer = setInterval(() => {
              setValue(Date.now());
            }, 1000);
            return () => clearInterval(timer);
          }, []);
        }
      `,
      },
      {
        name: "useEffect with cleanup and sync setter, but setter not referenced in cleanup",
        code: js`
        function C() {
          const [count, setCount] = useState(0);
          useEffect(() => {
            setCount(0);
            const timer = setInterval(() => {}, 1000);
            return () => clearInterval(timer);
          }, []);
        }
      `,
      },
      {
        name: "Fetching data with cleanup (ignore pattern)",
        code: js`
        function C({ query }) {
          const [results, setResults] = useState([]);
          useEffect(() => {
            let ignore = false;
            fetchResults(query).then((json) => {
              if (!ignore) setResults(json);
            });
            return () => { ignore = true; };
          }, [query]);
        }
      `,
      },
      {
        name: "Store subscribe returns unsubscribe, no sync setter in body",
        code: js`
        function useStoreValue(store) {
          const [value, setValue] = useState(store.get());
          useEffect(() => {
            const unsubscribe = store.subscribe((v) => setValue(v));
            return unsubscribe;
          }, [store]);
          return value;
        }
      `,
      },
      {
        name: "Multiple setters, none connected to cleanup",
        code: js`
        function C() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          useEffect(() => {
            setA(1);
            setB(2);
            const id = setInterval(() => {}, 0);
            return () => clearInterval(id);
          }, []);
        }
      `,
      },
      {
        name: "Cleanup references a callback that doesn't touch the setter",
        code: js`
        function C() {
          const [isOnline, setIsOnline] = useState(true);
          useEffect(() => {
            setIsOnline(navigator.onLine);
            const cb = () => console.log('no setter here');
            window.addEventListener('click', cb);
            return () => window.removeEventListener('click', cb);
          }, []);
        }
      `,
      },
      {
        name: "Synchronous setter via .then (async, not sync)",
        code: js`
        function C() {
          const [data, setData] = useState(null);
          useEffect(() => {
            fetch('/data').then((res) => setData(res));
            return () => abortController.abort();
          }, []);
        }
      `,
      },
      {
        name: "void expression wrapping synchronous setter, cleanup not connected",
        code: js`
        function C() {
          const [x, setX] = useState(0);
          useEffect(() => {
            void setX(readExternal());
            return () => console.log('cleanup');
          }, []);
        }
      `,
      },
      {
        name: "Body setter and cleanup reference different setters of same component",
        code: js`
        function C() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          useEffect(() => {
            setA(readExternal());
            const hb = (v) => setB(v);
            store.subscribe(hb);
            return () => store.unsubscribe(hb);
          }, []);
        }
      `,
      },
    ],
    invalid: [
      {
        name: "Canonical useOnlineStatus pattern from docs",
        code: js`
        function useOnlineStatus() {
          const [isOnline, setIsOnline] = useState(true);
          useEffect(() => {
            function updateState() {
              setIsOnline(navigator.onLine);
            }
            updateState();
            window.addEventListener('online', updateState);
            window.addEventListener('offline', updateState);
            return () => {
              window.removeEventListener('online', updateState);
              window.removeEventListener('offline', updateState);
            };
          }, []);
          return isOnline;
        }
      `,
        errors: error("avoidExternalStoreSubscription", { state: "isOnline" }),
      },
      {
        name: "Setter referenced directly in cleanup",
        code: js`
        function C() {
          const [isOnline, setIsOnline] = useState(true);
          useEffect(() => {
            setIsOnline(navigator.onLine);
            return () => setIsOnline(false);
          }, []);
        }
      `,
        errors: error("avoidExternalStoreSubscription", { state: "isOnline" }),
      },
      {
        name: "Handler referenced in cleanup calls the setter",
        code: js`
        function useStoreValue(store) {
          const [value, setValue] = useState(0);
          useEffect(() => {
            setValue(store.get());
            const handler = (v) => setValue(v);
            store.subscribe(handler);
            return () => store.unsubscribe(handler);
          }, [store]);
          return value;
        }
      `,
        errors: error("avoidExternalStoreSubscription", { state: "value" }),
      },
      {
        name: "Multiple setters, one matching cleanup",
        code: js`
        function C() {
          const [x, setX] = useState(0);
          const [y, setY] = useState(0);
          useEffect(() => {
            setX(readStoreX());
            setY(readStoreY());
            const handlerX = (v) => setX(v);
            const handlerY = (v) => setY(v);
            storeX.subscribe(handlerX);
            storeY.subscribe(handlerY);
            return () => {
              storeX.unsubscribe(handlerX);
              storeY.unsubscribe(handlerY);
            };
          }, []);
        }
      `,
        errors: [
          { messageId: "avoidExternalStoreSubscription", data: { state: "x" } },
          { messageId: "avoidExternalStoreSubscription", data: { state: "y" } },
        ],
      },
      {
        name: "Multiple sync setters, cleanup references one via arrow body",
        code: js`
        function C() {
          const [x, setX] = useState(0);
          const [y, setY] = useState(0);
          useEffect(() => {
            setX(readStoreX());
            setY(readStoreY());
            const hx = (v) => setX(v);
            storeX.onChange(hx);
            return () => storeX.offChange(hx);
          }, []);
        }
      `,
        errors: [
          { messageId: "avoidExternalStoreSubscription", data: { state: "x" } },
        ],
      },
      {
        name: "Setter via callback setter (setX(c => ...)) both in body and cleanup",
        code: js`
        function C() {
          const [count, setCount] = useState(0);
          useEffect(() => {
            setCount(readExternal());
            return () => setCount(c => c + 1);
          }, []);
        }
      `,
        errors: error("avoidExternalStoreSubscription", { state: "count" }),
      },
    ],
  },
);
