// The item's name beside its icon while the menu is shrunk. Shows at once on
// hover or keyboard focus (the browser's own hover label waits about a
// second; owner, Oct 22). The item needs `relative group/item`.
export function MenuTip({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 hidden -translate-y-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background shadow-md group-data-[collapsed=true]/side:group-hover/item:block group-data-[collapsed=true]/side:group-focus-visible/item:block"
    >
      {children}
    </span>
  );
}
