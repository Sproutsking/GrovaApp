import React from "react";
import { act, render, screen } from "@testing-library/react";
import { usePullToRefresh } from "./usePullToRefresh";

function PullToRefreshHarness({ onRefresh, enabled, onTarget, triggerRef, renderCount }) {
  const { containerRef, indicatorRef, triggerRefresh } = usePullToRefresh(onRefresh, enabled);
  if (renderCount) renderCount.current += 1;
  if (triggerRef) triggerRef.current = triggerRefresh;
  return (
    <main
      ref={(node) => {
        containerRef.current = node;
        if (node) onTarget?.(node);
      }}
    >
      <div ref={indicatorRef} data-testid="pull-to-refresh-indicator">
        <i data-pull-refresh-icon />
      </div>
    </main>
  );
}

describe("usePullToRefresh", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("uses a passive touchmove listener so native mobile scrolling is not delayed", () => {
    let addEventListener;
    render(
      <PullToRefreshHarness
        onRefresh={jest.fn()}
        enabled
        onTarget={(node) => {
          addEventListener = jest.spyOn(node, "addEventListener");
        }}
      />,
    );

    const touchMoveRegistration = addEventListener.mock.calls.find(
      ([eventName, , options]) => eventName === "touchmove" && options?.passive === true,
    );
    expect(touchMoveRegistration?.[2]).toEqual({ passive: true });
  });

  it("does not attach touch handlers when pull-to-refresh is disabled", () => {
    let addEventListener;
    render(
      <PullToRefreshHarness
        onRefresh={jest.fn()}
        enabled={false}
        onTarget={(node) => {
          addEventListener = jest.spyOn(node, "addEventListener");
        }}
      />,
    );

    expect(addEventListener.mock.calls.some(([eventName]) => eventName.startsWith("touch"))).toBe(false);
  });

  it("calls the supplied refresh handler", async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const triggerRef = { current: null };
    render(
      <PullToRefreshHarness
        onRefresh={onRefresh}
        enabled
        triggerRef={triggerRef}
      />,
    );

    await act(async () => {
      await triggerRef.current();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("updates the pull indicator without rerendering the app during touch movement", () => {
    const renderCount = { current: 0 };
    let container;
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback();
      return 1;
    });
    render(
      <PullToRefreshHarness
        onRefresh={jest.fn()}
        enabled
        renderCount={renderCount}
        onTarget={(node) => {
          container = node;
        }}
      />,
    );
    const start = new Event("touchstart", { bubbles: true });
    Object.defineProperty(start, "touches", { value: [{ clientX: 10, clientY: 10 }] });
    const move = new Event("touchmove", { bubbles: true, cancelable: true });
    Object.defineProperty(move, "touches", { value: [{ clientX: 10, clientY: 70 }] });

    act(() => {
      container.dispatchEvent(start);
      container.dispatchEvent(move);
    });

    expect(renderCount.current).toBe(1);
    expect(screen.getByTestId("pull-to-refresh-indicator").style.display).toBe("flex");
    expect(move.defaultPrevented).toBe(false);
  });
});
