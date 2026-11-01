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

  return <div>{state}</div>;
}
