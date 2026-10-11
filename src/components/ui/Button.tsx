import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "group inline-flex items-center justify-center gap-x-2.5 font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.16em] leading-none whitespace-nowrap touch-manip select-none transition-[color,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] disabled:opacity-50 disabled:pointer-events-none";

const sizeMap: Record<Size, string> = {
  md: "h-11 px-6",
  lg: "h-[52px] px-8",
};

const variantMap: Record<Variant, string> = {
  primary: "bg-ember text-on-ember hover:bg-ember-deep",
  secondary:
    "border border-line-strong text-porcelain hover:bg-porcelain hover:text-noir hover:border-porcelain",
  ghost: "px-0 text-porcelain",
};

type CommonProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
  className?: string;
};

type AsLink = CommonProps & {
  href: string;
  external?: boolean;
  onClick?: never;
  type?: never;
  disabled?: never;
  "aria-label"?: string;
};

type AsButton = CommonProps & {
  href?: never;
  external?: never;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  "aria-label"?: string;
};

type ButtonProps = AsLink | AsButton;

function Inner({
  children,
  variant,
  arrow,
}: {
  children: ReactNode;
  variant: Variant;
  arrow: boolean;
}) {
  return (
    <>
      <span className={variant === "ghost" ? "link-underline pb-1" : undefined}>
        {children}
      </span>
      {arrow && (
        <ArrowRight
          weight="light"
          className="size-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1"
          aria-hidden="true"
        />
      )}
    </>
  );
}

export function Button(props: ButtonProps) {
  const {
    children,
    variant = "primary",
    size = "md",
    arrow = variant !== "secondary",
    className,
  } = props;

  const classes = cn(
    base,
    variant !== "ghost" && sizeMap[size],
    variantMap[variant],
    className,
  );

  if ("href" in props && props.href !== undefined) {
    const { href, external } = props;
    if (external || /^(https?:|mailto:|tel:)/.test(href)) {
      return (
        <a
          href={href}
          className={classes}
          aria-label={props["aria-label"]}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          <Inner variant={variant} arrow={arrow}>
            {children}
          </Inner>
        </a>
      );
    }
    return (
      <Link href={href} className={classes} aria-label={props["aria-label"]}>
        <Inner variant={variant} arrow={arrow}>
          {children}
        </Inner>
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props["aria-label"]}
      className={classes}
    >
      <Inner variant={variant} arrow={arrow}>
        {children}
      </Inner>
    </button>
  );
}
