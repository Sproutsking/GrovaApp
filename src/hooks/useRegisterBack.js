import { useEffect } from "react";
import { useBackNavigation } from "../contexts/BackNavigationContext";

export default function useRegisterBack(handler, deps = []) {
  const { register } = useBackNavigation();

  useEffect(() => {
    if (typeof handler !== "function") return;
    const unregister = register(handler);
    return () => unregister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
