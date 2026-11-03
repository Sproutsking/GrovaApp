import React, { useContext, useEffect } from "react";
import { act, render } from "@testing-library/react";
import {
  BackNavigationContext,
  BackNavigationProvider,
} from "./BackNavigationContext";

const BackHandler = ({ handler }) => {
  const { register } = useContext(BackNavigationContext);

  useEffect(() => register(handler), [handler, register]);

  return null;
};

describe("BackNavigationProvider", () => {
  let forwardSpy;

  beforeEach(() => {
    forwardSpy = jest.spyOn(window.history, "forward").mockImplementation(() => {});
  });

  afterEach(() => {
    forwardSpy.mockRestore();
  });

  it("restores a handled back press before route listeners receive it", () => {
    const handler = jest.fn(() => true);
    const routeListener = jest.fn();
    const removeRouteListener = () => window.removeEventListener("popstate", routeListener);

    render(
      <BackNavigationProvider>
        <BackHandler handler={handler} />
      </BackNavigationProvider>
    );
    window.addEventListener("popstate", routeListener);

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(forwardSpy).toHaveBeenCalledTimes(1);
    expect(routeListener).not.toHaveBeenCalled();

    removeRouteListener();
  });

  it("allows route listeners to handle an unhandled back press", () => {
    const handler = jest.fn(() => false);
    const routeListener = jest.fn();
    const removeRouteListener = () => window.removeEventListener("popstate", routeListener);

    render(
      <BackNavigationProvider>
        <BackHandler handler={handler} />
      </BackNavigationProvider>
    );
    window.addEventListener("popstate", routeListener);

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(forwardSpy).not.toHaveBeenCalled();
    expect(routeListener).toHaveBeenCalledTimes(1);

    removeRouteListener();
  });
});
