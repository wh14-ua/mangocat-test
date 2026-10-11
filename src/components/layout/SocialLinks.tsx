import {
  InstagramLogo,
  FacebookLogo,
  XLogo,
  TiktokLogo,
  YoutubeLogo,
  LinkedinLogo,
} from "@phosphor-icons/react/dist/ssr";
import { site } from "@/config";
import type { SocialLink } from "@/config";
import { cn } from "@/lib/cn";

const iconMap = {
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  x: XLogo,
  tiktok: TiktokLogo,
  youtube: YoutubeLogo,
  linkedin: LinkedinLogo,
} as const;

export function SocialLinks({
  className,
  itemClassName,
}: {
  className?: string;
  itemClassName?: string;
}) {
  return (
    <ul className={cn("flex items-center gap-x-5", className)}>
      {site.social.map((s: SocialLink) => {
        const Icon = iconMap[s.icon];
        return (
          <li key={s.icon}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              className={cn(
                "inline-flex text-mist transition-colors duration-300 hover:text-ember focus-visible:text-ember",
                itemClassName,
              )}
            >
              <Icon weight="light" className="size-5" aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
