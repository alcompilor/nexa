export const SectionCard = ({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) => (
    <div className="bg-white rounded-xl shadow-md p-6 space-y-4 border-1 border-gray-200">
        <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>
        {children}
    </div>
);
