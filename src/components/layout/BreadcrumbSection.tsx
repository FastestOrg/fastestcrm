import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { BreadcrumbSchema } from '@/components/SchemaMarkup';

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface BreadcrumbSectionProps {
  items: BreadcrumbItem[];
}

const BreadcrumbSection: React.FC<BreadcrumbSectionProps> = ({ items }) => {
  const schemaItems = [
    { name: 'Home', item: 'https://www.fastestcrm.com' },
    ...items.map(item => ({
      name: item.name,
      item: `https://www.fastestcrm.com${item.path}`
    }))
  ];

  return (
    <nav className="flex py-4 px-6 container mx-auto text-sm text-muted-foreground" aria-label="Breadcrumb">
      <BreadcrumbSchema items={schemaItems} />
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        <li className="inline-flex items-center">
          <Link to="/" className="inline-flex items-center hover:text-primary transition-colors">
            <Home className="w-4 h-4 mr-2" />
            Home
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index}>
            <div className="flex items-center">
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 mx-1" />
              <Link
                to={item.path}
                className={`ml-1 md:ml-2 hover:text-primary transition-colors ${
                  index === items.length - 1 ? 'text-foreground font-medium' : ''
                }`}
              >
                {item.name}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default BreadcrumbSection;
