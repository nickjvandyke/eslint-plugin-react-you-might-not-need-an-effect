// The syntax stays JavaScript-compatible so this test can run without a
// TypeScript parser. The file extension is what matters here.
function useState(initial) {
  return [initial, () => {}];
}

function useEffect() {}

export function Component() {
  const [state, setState] = useState(0);
  const [otherState] = useState(0);

  useEffect(() => {
    setState(otherState * 2);
  }, [otherState]);

  return state;
}
