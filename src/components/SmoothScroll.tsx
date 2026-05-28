import React from 'react';

interface SmoothScrollProps {
    children: React.ReactNode;
}

const SmoothScroll: React.FC<SmoothScrollProps> = ({ children }) => (
    <div className="w-full min-h-screen">{children}</div>
);

export default SmoothScroll;
