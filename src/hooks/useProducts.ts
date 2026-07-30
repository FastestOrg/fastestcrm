import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrgClient } from '@/hooks/useOrgClient';

export interface Product {
    id: string;
    company_id: string;
    category: string;
    name: string;
    price: number;
    quantity_available: number | null;
    created_at: string;
    updated_at: string;
}

export interface ProductInput {
    category: string;
    name: string;
    price: number;
    quantity_available?: number | null;
}

export function useProducts() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { orgClient, isBYOSLoading } = useOrgClient();

    const { data: products, isLoading, error } = useQuery({
        queryKey: ['products', (orgClient as any)?.supabaseUrl || 'default'],
        queryFn: async (): Promise<Product[]> => {
            const { data, error } = await orgClient
                .from('products')
                .select('*')
                .order('category', { ascending: true })
                .order('name', { ascending: true });

            if (error) {
                console.error('Error fetching products:', error);
                throw error;
            }
            return (data || []) as Product[];
        },
        enabled: !isBYOSLoading,
    });

    const createProduct = useMutation({
        mutationFn: async (newProduct: ProductInput) => {
            // Get current user's company_id from platform auth/profile
            const { data: profile } = await supabase.auth.getUser();
            if (!profile.user) throw new Error('Not authenticated');

            const { data: userProfile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', profile.user.id)
                .single();

            if (!userProfile?.company_id) throw new Error('No company found');

            const { data, error } = await orgClient
                .from('products')
                .insert([{ ...newProduct, company_id: userProfile.company_id }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast({
                title: 'Success',
                description: 'Product created successfully',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to create product',
                variant: 'destructive',
            });
        },
    });

    const updateProduct = useMutation({
        mutationFn: async ({ id, ...updates }: Partial<ProductInput> & { id: string }) => {
            const { data, error } = await orgClient
                .from('products')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast({
                title: 'Success',
                description: 'Product updated successfully',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update product',
                variant: 'destructive',
            });
        },
    });

    const deleteProduct = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await orgClient
                .from('products')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast({
                title: 'Success',
                description: 'Product deleted successfully',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to delete product',
                variant: 'destructive',
            });
        },
    });

    return {
        products,
        isLoading,
        error,
        createProduct,
        updateProduct,
        deleteProduct,
    };
}
