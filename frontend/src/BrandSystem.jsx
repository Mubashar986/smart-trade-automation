function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function BrandMark({ className }) {
  return (
    <span className={cx('brand-mark', className)} aria-hidden="true">
      <svg viewBox="0 0 32 32" role="presentation">
        <rect x="1" y="1" width="30" height="30" rx="10" />
        <path d="M6.5 16h4.2l2.3-5.8 4.2 12 2.4-6.2h5.9" />
      </svg>
    </span>
  )
}

export function BrandLockup({
  label = 'SmartTrade AI',
  className,
  textClassName,
}) {
  return (
    <div className={cx('brand-lockup', className)}>
      <BrandMark />
      <span className={cx('brand-text', textClassName)}>{label}</span>
    </div>
  )
}

export function IconChip({ children, className, tone = 'teal' }) {
  return <span className={cx('icon-chip', `icon-chip-${tone}`, className)}>{children}</span>
}

function IconBase({ className, children }) {
  return (
    <svg
      className={cx('app-icon', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function CheckCircleIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.75" />
      <path d="m8.7 12.1 2.2 2.3 4.5-4.8" />
    </IconBase>
  )
}

export function ShieldIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3.7 6.7 5.8v5.2c0 3.5 2 6 5.3 7.3 3.3-1.3 5.3-3.8 5.3-7.3V5.8L12 3.7Z" />
      <path d="m9.5 11.8 1.7 1.8 3.2-3.5" />
    </IconBase>
  )
}

export function CodeBracketsIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m9.2 8.2-4 3.8 4 3.8" />
      <path d="m14.8 8.2 4 3.8-4 3.8" />
    </IconBase>
  )
}

export function DocumentIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M8 4.5h5.7l3.3 3.3v11.7H8z" />
      <path d="M13.7 4.5v3.4h3.4" />
      <path d="M10.4 13.2h4.8" />
      <path d="M10.4 16.3h4.8" />
    </IconBase>
  )
}

export function EyeIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5Z" />
      <circle cx="12" cy="12" r="2.6" />
    </IconBase>
  )
}

export function WarningIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 4.6 4.8 18h14.4L12 4.6Z" />
      <path d="M12 9.5v4.6" />
      <path d="M12 17.1h.01" />
    </IconBase>
  )
}

export function UserIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8.6" r="3.2" />
      <path d="M6.4 18c1.4-2.3 3.2-3.5 5.6-3.5s4.2 1.2 5.6 3.5" />
    </IconBase>
  )
}

export function PulseIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M3.8 12h3.6l1.9-4.5 3 9 2.2-5.5h5.7" />
    </IconBase>
  )
}

export function BookIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5.7 6.8c0-1 .8-1.8 1.8-1.8h8.8v13.8H8.2a2.5 2.5 0 0 0-2.5 2.5z" />
      <path d="M8.2 5v13.8" />
      <path d="M8.2 18.8h9.6" />
    </IconBase>
  )
}

export function SparkIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m12 4.2 1.2 3.6 3.6 1.2-3.6 1.2L12 13.8l-1.2-3.6-3.6-1.2 3.6-1.2L12 4.2Z" />
      <path d="m17.5 13.5.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8Z" />
    </IconBase>
  )
}

export function ChevronDownIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m7.5 10.3 4.5 4.5 4.5-4.5" />
    </IconBase>
  )
}

