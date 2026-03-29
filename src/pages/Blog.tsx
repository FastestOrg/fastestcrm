import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { blogs } from '@/data/blogs';
import { ArrowLeft, ArrowRight, User } from 'lucide-react';
import SEO from '@/components/SEO';
import { BreadcrumbSchema } from '@/components/SchemaMarkup';

export default function Blog() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <SEO 
                title="Sales & CRM Insights | Fastest CRM Blog"
                description="Expert tips, strategies, and trends in AI CRM, lead generation, and sales automation to help your Indian sales team grow faster."
                keywords="sales tips, CRM blog, lead generation strategies, sales automation trends, AI in sales, CRM best practices"
                canonical="https://fastestcrm.com/blog"
            />
            <BreadcrumbSchema items={[
                { name: 'Home', item: 'https://fastestcrm.com' },
                { name: 'Blog', item: 'https://fastestcrm.com/blog' }
            ]} />
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Link to="/" className="flex items-center gap-2">
                            <img src="/fastestcrmlogo.png" alt="Fastest CRM" className="w-10 h-10 object-contain" />
                            <span className="text-xl font-bold">Fastest CRM</span>
                        </Link>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/">
                            <Button variant="ghost" size="sm" className="gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Back to Home
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-6">
                <div className="container mx-auto">
                    <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <h1 className="text-4xl md:text-6xl font-bold mb-6">
                            Insights for the <span className="gradient-text">Fastest Growth</span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Expert tips, strategies, and trends to help you sell smarter and faster.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {blogs.map((blog, index) => (
                            <Link
                                key={blog.id}
                                to={`/blog/${blog.slug}`}
                                className="group relative flex flex-col h-full rounded-2xl bg-card border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700"
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <div className="aspect-video w-full overflow-hidden">
                                    <img
                                        src={blog.image}
                                        alt={blog.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                </div>

                                <div className="flex flex-col flex-grow p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">
                                            {blog.category}
                                        </span>
                                        <span className="text-xs text-muted-foreground ml-auto">
                                            {blog.readTime}
                                        </span>
                                    </div>

                                    <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors line-clamp-2">
                                        {blog.title}
                                    </h2>

                                    <p className="text-muted-foreground line-clamp-3 mb-6 flex-grow">
                                        {blog.excerpt}
                                    </p>

                                    <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <User className="h-4 w-4" />
                                            <span>{blog.author}</span>
                                        </div>
                                        <span className="text-sm font-semibold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                            Read Article <ArrowRight className="h-4 w-4" />
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </main>

            {/* Newsletter CTA */}
            <section className="py-20 px-6 bg-secondary/30">
                <div className="container mx-auto max-w-4xl text-center">
                    <h2 className="text-3xl font-bold mb-6">Stay Updated</h2>
                    <p className="text-lg text-muted-foreground mb-8">
                        Get the latest sales tips and CRM insights delivered straight to your inbox.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                        <input
                            type="email"
                            placeholder="Enter your work email"
                            className="px-4 py-3 rounded-md bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 w-full"
                        />
                        <Button size="lg" className="gradient-primary whitespace-nowrap">
                            Subscribe Free
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-border/50 bg-background/50 backdrop-blur-sm">
                <div className="container mx-auto text-center">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} Fastest CRM. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
