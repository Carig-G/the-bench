import { ReactNode } from 'react';

interface ConversationGridProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  emptyState?: ReactNode;
  isEmpty?: boolean;
}

export function ConversationGrid({
  title,
  subtitle,
  children,
  emptyState,
  isEmpty,
}: ConversationGridProps) {
  return (
    <section className="mb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-warmgray-800">{title}</h2>
        {subtitle && <p className="text-warmgray-500 mt-1">{subtitle}</p>}
      </div>

      {isEmpty ? (
        emptyState
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children}
        </div>
      )}
    </section>
  );
}
