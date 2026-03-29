import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { blogs } from '@/data/blogs';
import { ArrowLeft, Clock, Calendar, User, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import SEO from '@/components/SEO';
import { BreadcrumbSchema, ArticleSchema } from '@/components/SchemaMarkup';

export default function BlogPost() {
    const { slug } = useParams();
    const navigate = useNavigate();

    const blog = blogs.find(b => b.slug === slug);

    useEffect(() => {
        if (!blog) {
            navigate('/blog');
        }
        // Scroll to top on load
        window.scrollTo(0, 0);
    }, [blog, navigate]);

    if (!blog) return null;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <SEO 
                title={blog.title}
                description={blog.excerpt}
                ogType="article"
                ogImage={blog.image}
                keywords={`${blog.category}, ${blog.title.split(' ').join(', ')}, Fastest CRM`}
                canonical={`https://fastestcrm.com/blog/${blog.slug}`}
            />
            <BreadcrumbSchema items={[
                { name: 'Home', item: 'https://fastestcrm.com' },
                { name: 'Blog', item: 'https://fastestcrm.com/blog' },
                { name: blog.title, item: `https://fastestcrm.com/blog/${blog.slug}` }
            ]} />
            <ArticleSchema 
                title={blog.title}
                description={blog.excerpt}
                image={blog.image}
                author={blog.author}
                datePublished={blog.date}
                url={`https://fastestcrm.com/blog/${blog.slug}`}
            />
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/blog">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Blog
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Link to="/" className="flex items-center gap-2">
                            <img src="/fastestcrmlogo.png" alt="Fastest CRM" className="w-8 h-8 object-contain" />
                            <span className="font-bold hidden sm:inline">Fastest CRM</span>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Image */}
            <div className="relative pt-20">
                <div className="h-[40vh] md:h-[50vh] w-full overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10"></div>
                    <img
                        src={blog.image}
                        alt={blog.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            </div>

            <main className="container mx-auto px-6 -mt-32 relative z-20 pb-20">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="bg-card border border-border/50 rounded-2xl p-8 md:p-12 shadow-xl mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                                {blog.category}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {blog.readTime}
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(blog.date), 'MMMM d, yyyy')}
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                            {blog.title}
                        </h1>

                        <div className="flex items-center justify-between border-t border-border/50 pt-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                                    <User className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="font-semibold">{blog.author}</p>
                                    <p className="text-xs text-muted-foreground">Content Writer</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Share2 className="h-4 w-4" />
                                Share
                            </Button>
                        </div>
                    </div>

                    {/* Content */}
                    <article className="prose prose-lg dark:prose-invert max-w-none animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        <div dangerouslySetInnerHTML={{ __html: blog.content }} />
                    </article>

                    {/* CTA Box */}
                    <div className="mt-16 p-8 rounded-2xl bg-primary/5 border border-primary/20 text-center animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                        <h3 className="text-2xl font-bold mb-4">Want to implement these strategies?</h3>
                        <p className="text-muted-foreground mb-6">
                            See how Fastest CRM can help you automate your sales process and grow faster.
                        </p>
                        <Link to="/register-company">
                            <Button size="lg" className="gradient-primary">
                                Register Your Company
                            </Button>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
