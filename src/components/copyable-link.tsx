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
    <div className={containerClassName ?? "rounded-lg border border-slate-200 bg-slate-50 p-3"}>
      <p className={labelClassName ?? "text-xs font-medium uppercase text-slate-500"}>{label}</p>
      <a className={linkClassName ?? "mt-1 block break-all text-sm text-blue-700"} href={href}>
        {href}
      </a>
      <CopyLinkButton
        value={href}
        className={
          buttonClassName ??
          "mt-2 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        }
      />
    </div>
  );
}
