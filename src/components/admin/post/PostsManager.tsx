'use client';

import { adminApi } from '@/src/lib/api';
import { Post, TopCategory } from '@/src/types';
import { useEffect, useState } from 'react';
import { SubsectionFilter } from '../subsections/SubSectionFilter';
import { PostForm } from './postForm';
import { PostListItem } from './postListItem';
import { PostEditModal } from './PostEditModal';
import { ContentLoader } from '../../ui/Spinner';
import { ConfirmDialog } from '@/src/components/ui/confirm-dialog';
import { Notice } from '@/src/components/ui/notice';

const INITIAL_FORM_DATA = {
  title: '',
  description: '',
  content: '',
  excerpt: '',
  coverImage: '',
  published: false,
  tags: '',
  projectLink: '',
  archiveYear: null as number | null,
};

type DisplayStyleInput = 'blog' | 'project' | 'title_only';

export function PostsManager() {
  const [sections, setSections] = useState<TopCategory[]>([]);
  const [selectedSubsection, setSelectedSubsection] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [error, setError] = useState('');
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetchSections();
  }, []);

  useEffect(() => {
    if (selectedSubsection) {
      const filtered = allPosts.filter(p => p.subsection.slug === selectedSubsection);
      setPosts(filtered);
    } else {
      setPosts(allPosts);
    }
  }, [selectedSubsection, allPosts]);

  const fetchSections = async () => {
    try {
      const res = await adminApi.getSections() as { sections: TopCategory[] };
      setSections(res.sections);
      
      const allSubsections = res.sections.flatMap((s) => s.subsections || []);
      const postsPromises = allSubsections.map(sub => 
        adminApi.getPosts(sub.slug).catch(() => ({ posts: [] }))
      );
      
      const postsResults = await Promise.all(postsPromises);
      const allPostsArray = postsResults.flatMap((r) => (r as { posts?: Post[] }).posts ?? []);
      setAllPosts(allPostsArray);
      setPosts(allPostsArray);
    } catch (error) {
      console.error('Failed to fetch sections:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSubsectionDisplayStyle = (subsectionSlug: string): DisplayStyleInput => {
    const subsection = sections
      .flatMap(s => s.subsections || [])
      .find(sub => sub.slug === subsectionSlug);
    
    // Map Prisma enum to form input
    const displayStyleMap: Record<string, DisplayStyleInput> = {
      'BLOG': 'blog',
      'PROJECT': 'project',
      'TITLE_ONLY': 'title_only'
    };
    
    return displayStyleMap[subsection?.displayStyle || 'BLOG'] || 'blog';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedSubsection) {
      setError('Please select a subsection');
      return;
    }

    const displayStyle = getSubsectionDisplayStyle(selectedSubsection);

    // Validate based on subsection's display style
    if (displayStyle === 'project' && !formData.projectLink) {
      setError('Project link is required for project-style subsections');
      return;
    }

    if (displayStyle === 'blog' && !formData.content) {
      setError('Content is required for blog-style subsections');
      return;
    }

    // For title_only, description is optional
    if (displayStyle !== 'title_only' && !formData.description) {
      setError('Description is required for this subsection type');
      return;
    }

    try {
      const tags = formData.tags.split(',').map((t) => t.trim()).filter(Boolean);
      
      // For title_only posts, send empty description
      const postData = {
        ...formData,
        description: displayStyle === 'title_only' ? '' : formData.description,
        tags,
      };
      
      await adminApi.createPost(selectedSubsection, postData);
      
      setFormData(INITIAL_FORM_DATA);
      setShowForm(false);
      fetchSections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the post.');
    }
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
  };

  const handleCloseEdit = () => {
    setEditingPost(null);
  };

  const handleSaveEdit = () => {
    fetchSections();
  };

  const handleTogglePublish = async (post: Post) => {
    setActionError('');
    try {
      await adminApi.togglePublish(
        post.subsection.slug,
        post.slug,
        !post.published
      );
      fetchSections();
    } catch (err) {
      // Reported where it happened instead of in a modal that blocks the list (the
      // baseline used window.alert, src/components/admin/post/PostsManager.tsx:155).
      setActionError(
        `${post.title} is still ${post.published ? 'published' : 'a draft'}. ${
          err instanceof Error ? err.message : 'The request failed.'
        }`,
      );
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setActionError('');
    try {
      await adminApi.deletePost(pendingDelete.subsection.slug, pendingDelete.slug);
      const title = pendingDelete.title;
      setPendingDelete(null);
      fetchSections();
      setActionError('');
      setNotice(`${title} was deleted.`);
    } catch (err) {
      setActionError(`${pendingDelete.title} was not deleted. ${err instanceof Error ? err.message : 'The request failed.'}`);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setFormData(INITIAL_FORM_DATA);
    setError('');
  };

  const allSubsections = sections.flatMap((s) => s.subsections || []);

  // Calculate post counts per subsection
  const postCounts: Record<string, number> = {};
  allPosts.forEach(post => {
    postCounts[post.subsection.slug] = (postCounts[post.subsection.slug] || 0) + 1;
  });

  const currentDisplayStyle = selectedSubsection ? getSubsectionDisplayStyle(selectedSubsection) : 'blog';

  if (loading) {
    return <ContentLoader />;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <h1 className="text-2xl sm:text-[28px] font-normal text-white">Posts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full sm:w-auto px-4 py-2 bg-white text-[#0a0a0a] rounded-lg hover:opacity-90 transition text-[13px] font-medium touch-manipulation"
        >
          {showForm ? 'Cancel' : '+ New Post'}
        </button>
      </div>

      {actionError && (
        <Notice
          assertive
          className="mb-[var(--admin-space-4)]"
          onDismiss={() => setActionError('')}
          tone="error"
        >
          {actionError}
        </Notice>
      )}

      {notice && (
        <Notice className="mb-[var(--admin-space-4)]" onDismiss={() => setNotice('')} tone="success">
          {notice}
        </Notice>
      )}

      {/* Subsection Filter */}
      <SubsectionFilter
        subsections={allSubsections}
        selectedSubsection={selectedSubsection}
        onChange={setSelectedSubsection}
        postCounts={postCounts}
        totalPosts={allPosts.length}
      />

      {/* Post Form */}
      {showForm && (
        <PostForm
          formData={formData}
          onChange={setFormData}
          onSubmit={handleSubmit}
          onCancel={handleCancelForm}
          subsections={allSubsections}
          selectedSubsection={selectedSubsection}
          onSubsectionChange={setSelectedSubsection}
          error={error}
          displayStyle={currentDisplayStyle}
        />
      )}

      {/* Posts List */}
      <div className="space-y-3">
        {posts.map((post) => (
          <PostListItem
            key={post.id}
            post={post}
            onTogglePublish={handleTogglePublish}
            onDelete={(post) => {
              setActionError('');
              setNotice('');
              setPendingDelete(post);
            }}
            onEdit={handleEdit}
          />
        ))}

        {posts.length === 0 && (
          <div className="bg-[#101010] p-6 sm:p-8 rounded-xl border border-[#1a1a1a] text-center">
            <p className="text-[14px] text-[#707070] mb-4">
              {selectedSubsection ? 'No posts in this subsection yet' : 'No posts yet'}
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="text-[13px] text-white hover:opacity-70 transition"
            >
              Create your first post
            </button>
          </div>
        )}
      </div>

      {/* Deleting a post is unrecoverable (there is no trash), so the row control opens the
          shared confirmation dialog instead of window.confirm, and it says where the post
          lives so the person can tell two same-titled posts apart. */}
      {pendingDelete && (
        <ConfirmDialog
          busy={deleting}
          description={`It lives in ${pendingDelete.subsection.name} and is ${
            pendingDelete.published ? 'live on the public site' : 'a draft'
          }. Deleting removes it permanently; there is no undo.`}
          itemName={pendingDelete.title}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDelete}
          title="Delete post"
        />
      )}

      {/* Edit Modal */}
      {editingPost && (
        <PostEditModal
          post={editingPost}
          onClose={handleCloseEdit}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
