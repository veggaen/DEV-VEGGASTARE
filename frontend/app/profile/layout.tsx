interface ProfileLayoutProps {
  children: React.ReactNode;
}

export default function ProfileLayout({ children }: ProfileLayoutProps) {
  return (
    <div className="flex flex-1 flex-col w-full min-h-0">
      {children}
    </div>
  );
}
