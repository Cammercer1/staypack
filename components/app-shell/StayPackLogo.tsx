import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO_WIDTH = 1018;
const LOGO_HEIGHT = 228;

type Props = {
  href?: string;
  className?: string;
  imageClassName?: string;
  height?: number;
};

export function StayPackLogo({
  href = "/dashboard",
  className,
  imageClassName,
  height = 24,
}: Props) {
  const width = Math.round((height * LOGO_WIDTH) / LOGO_HEIGHT);

  const logo = (
    // Plain img keeps PNG transparency; next/image can flatten alpha to black.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/staypack-logo.png"
      alt="StayPack"
      width={width}
      height={height}
      className={cn("block object-contain object-left", imageClassName)}
      style={{ height: `${height}px`, width: "auto", maxWidth: `${width}px` }}
    />
  );

  if (!href) {
    return <span className={cn("inline-flex shrink-0", className)}>{logo}</span>;
  }

  return (
    <Link href={href} className={cn("inline-flex shrink-0", className)}>
      {logo}
    </Link>
  );
}
