"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Navbar = dynamic(() => import("@/components/Navbar"), {
  ssr: false,
  loading: () => <NavbarPlaceholder />,
});

function NavbarPlaceholder() {
  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-50 hidden h-[4.25rem] border-b border-[var(--page-border)] bg-[color-mix(in_srgb,var(--page-card-solid)_88%,transparent)] backdrop-blur-[20px] lg:block"
      />
      <div
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-50 h-[74px] rounded-t-[1.35rem] border-t border-[var(--page-border)] bg-[color-mix(in_srgb,var(--page-card-solid)_88%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-[20px] lg:hidden"
      />
    </>
  );
}

/** Keep account/admin SDKs outside the critical hydration path. */
export default function DeferredNavbar() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const start = () => setReady(true);
    const idleWindow = window as typeof window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(start, { timeout: 1500 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(start, 500);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return ready ? <Navbar /> : <NavbarPlaceholder />;
}
