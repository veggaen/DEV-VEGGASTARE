interface ProfileLayoutProps {
  children: React.ReactNode;
}

export default function ProfileLayout({ children }: ProfileLayoutProps) {
  return (
    <div className="flex flex-col w-full pb-8">
      {children}
    </div>
  );
}
