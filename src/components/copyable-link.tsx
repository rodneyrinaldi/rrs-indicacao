import { CopyLinkButton } from "@/components/copy-link-button";

type CopyableLinkProps = {
  label: string;
  href: string;
  containerClassName?: string;
  labelClassName?: string;
  linkClassName?: string;
  buttonClassName?: string;
};

export function CopyableLink({
  label,
  href,
  containerClassName,
  labelClassName,
  linkClassName,
  buttonClassName,
}: CopyableLinkProps) {
  return (
    <div className={containerClassName ?? "rounded-xl border border-slate-200 bg-white/80 p-3"}>
      <p className={labelClassName ?? "text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"}>
        {label}
      </p>
      <a className={linkClassName ?? "mt-1.5 block break-all text-sm text-blue-700"} href={href}>
        {href}
      </a>
      <CopyLinkButton
        value={href}
        className={
          buttonClassName ??
          "mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        }
      />
    </div>
  );
}
