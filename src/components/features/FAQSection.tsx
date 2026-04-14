import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQSchema } from '@/components/SchemaMarkup';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  items: FAQItem[];
  title?: string;
  subtitle?: string;
}

const FAQSection: React.FC<FAQSectionProps> = ({ 
  items, 
  title = "Frequently Asked Questions", 
  subtitle = "Got questions? We've got answers." 
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 px-6 bg-secondary/20 border-y border-border/40" aria-labelledby="faq-heading">
      <FAQSchema faqs={items} />
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-14">
          <span className="text-xs font-bold text-primary uppercase tracking-widest mb-3 block">{subtitle}</span>
          <h2
            id="faq-heading"
            className="text-3xl md:text-5xl font-bold"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            {title.split(' ').map((word, i) => (
              <span key={i} className={i === title.split(' ').length - 1 ? 'gradient-text' : ''}>
                {word}{' '}
              </span>
            ))}
          </h2>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 bg-card/40 overflow-hidden hover:border-primary/30 transition-colors"
            >
              <button
                className="w-full flex justify-between items-center font-semibold cursor-pointer px-6 py-5 text-left hover:bg-muted/20 transition-colors"
                onClick={() => toggleFAQ(i)}
                aria-expanded={openIndex === i}
              >
                <span className="text-base">{item.question}</span>
                <ChevronDown
                  className={`h-5 w-5 text-primary flex-shrink-0 ml-4 transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`}
                />
              </button>
              {openIndex === i && (
                <div className="text-muted-foreground px-6 pb-5 text-sm leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
