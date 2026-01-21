import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { stories as storiesApi, nodes as nodesApi, votes as votesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Story, StoryNode } from '../types';

interface TreeNode {
  node: StoryNode;
  children: TreeNode[];
}

function buildTree(nodes: StoryNode[]): TreeNode | null {
  const nodeMap = new Map<number, TreeNode>();
  let root: TreeNode | null = null;

  // Create tree nodes
  for (const node of nodes) {
    nodeMap.set(node.id, { node, children: [] });
  }

  // Build tree structure
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parent_node_id === null) {
      root = treeNode;
    } else {
      const parent = nodeMap.get(node.parent_node_id);
      if (parent) {
        parent.children.push(treeNode);
      }
    }
  }

  return root;
}

function TreeView({
  tree,
  currentNodeId,
  onSelectNode,
}: {
  tree: TreeNode;
  currentNodeId: number;
  onSelectNode: (id: number) => void;
}) {
  const isActive = tree.node.id === currentNodeId;

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => onSelectNode(tree.node.id)}
        className={`w-4 h-4 rounded-full transition-colors ${
          isActive
            ? 'bg-brand-500 ring-2 ring-brand-500/50'
            : 'bg-gray-600 hover:bg-gray-500'
        }`}
        title={`Chapter by ${tree.node.author_username}`}
      />
      {tree.children.length > 0 && (
        <>
          <div className="w-px h-4 bg-gray-700" />
          <div className="flex gap-4">
            {tree.children.map((child, i) => (
              <div key={child.node.id} className="flex flex-col items-center">
                {tree.children.length > 1 && (
                  <div
                    className={`h-px bg-gray-700 ${
                      i === 0
                        ? 'w-1/2 self-end'
                        : i === tree.children.length - 1
                        ? 'w-1/2 self-start'
                        : 'w-full'
                    }`}
                  />
                )}
                <TreeView
                  tree={child}
                  currentNodeId={currentNodeId}
                  onSelectNode={onSelectNode}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function StoryReader() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [story, setStory] = useState<Story | null>(null);
  const [nodes, setNodes] = useState<StoryNode[]>([]);
  const [currentNode, setCurrentNode] = useState<StoryNode | null>(null);
  const [path, setPath] = useState<StoryNode[]>([]);
  const [children, setChildren] = useState<StoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchContent, setBranchContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasVotedComplete, setHasVotedComplete] = useState(false);
  const [completeVotes, setCompleteVotes] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [pathIndex, setPathIndex] = useState(0);

  const tree = nodes.length > 0 ? buildTree(nodes) : null;

  const loadStory = useCallback(async () => {
    if (!id) return;
    try {
      const data = await storiesApi.get(parseInt(id));
      setStory(data.story);
      setNodes(data.nodes);
      setCompleteVotes(data.story.complete_votes || 0);

      // Set initial node to root
      const rootNode = data.nodes.find((n) => n.parent_node_id === null);
      if (rootNode) {
        setCurrentNode(rootNode);
        setPath([rootNode]);
        setPathIndex(0);
        // Load children
        const nodeData = await nodesApi.get(rootNode.id);
        setChildren(nodeData.children);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load story');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadStory();
  }, [loadStory]);

  useEffect(() => {
    if (user && id) {
      votesApi.getMyVotes(parseInt(id)).then((data) => {
        setHasVotedComplete(data.votes.some((v) => v.vote_type === 'complete'));
      }).catch(() => {});
    }
  }, [user, id]);

  const selectNode = async (nodeId: number) => {
    try {
      const [nodeData, pathData] = await Promise.all([
        nodesApi.get(nodeId),
        nodesApi.getPath(nodeId),
      ]);
      setCurrentNode(nodeData.node);
      setChildren(nodeData.children);
      setPath(pathData.path);
      setPathIndex(pathData.path.length - 1);
    } catch (err) {
      console.error('Failed to load node:', err);
    }
  };

  const navigatePath = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && pathIndex > 0) {
      const newIndex = pathIndex - 1;
      setPathIndex(newIndex);
      setCurrentNode(path[newIndex]);
      nodesApi.get(path[newIndex].id).then((data) => setChildren(data.children));
    } else if (direction === 'next' && pathIndex < path.length - 1) {
      const newIndex = pathIndex + 1;
      setPathIndex(newIndex);
      setCurrentNode(path[newIndex]);
      nodesApi.get(path[newIndex].id).then((data) => setChildren(data.children));
    }
  };

  const selectBranch = async (child: StoryNode) => {
    setPath([...path.slice(0, pathIndex + 1), child]);
    setPathIndex(pathIndex + 1);
    setCurrentNode(child);
    const nodeData = await nodesApi.get(child.id);
    setChildren(nodeData.children);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swipe left - next
        if (children.length === 1) {
          selectBranch(children[0]);
        }
      } else {
        // Swipe right - previous
        navigatePath('prev');
      }
    }
    setTouchStart(null);
  };

  const submitBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentNode || !id) return;

    setSubmitting(true);
    try {
      const result = await nodesApi.create({
        storyId: parseInt(id),
        parentNodeId: currentNode.id,
        content: branchContent,
      });
      setBranchContent('');
      setShowBranchForm(false);
      // Reload story to get updated nodes
      await loadStory();
      // Navigate to new node
      selectNode(result.node.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCompleteVote = async () => {
    if (!id || !user) return;
    try {
      if (hasVotedComplete) {
        await votesApi.remove(parseInt(id), 'complete');
        setHasVotedComplete(false);
        setCompleteVotes((v) => v - 1);
      } else {
        await votesApi.add(parseInt(id), 'complete');
        setHasVotedComplete(true);
        setCompleteVotes((v) => v + 1);
      }
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (error || !story || !currentNode) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center">
        <p className="text-red-400">{error || 'Story not found'}</p>
        <Link to="/stories" className="btn btn-secondary mt-4">
          Back to Stories
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
      {/* Tree sidebar - desktop */}
      <aside className="hidden lg:block w-64 border-r border-gray-800 p-4 overflow-auto">
        <h2 className="text-sm font-semibold text-gray-400 mb-4">Story Tree</h2>
        {tree && (
          <div className="flex justify-center overflow-auto pb-4">
            <TreeView tree={tree} currentNodeId={currentNode.id} onSelectNode={selectNode} />
          </div>
        )}
        <div className="mt-6 pt-4 border-t border-gray-800">
          <p className="text-sm text-gray-400">
            {nodes.length} chapters · {completeVotes} complete votes
          </p>
        </div>
      </aside>

      {/* Main reading area */}
      <main className="flex-1 flex flex-col">
        {/* Story header */}
        <div className="border-b border-gray-800 p-4">
          <h1 className="text-xl font-bold">{story.title}</h1>
          <p className="text-sm text-gray-400">
            by {story.creator_username} · Chapter {pathIndex + 1} of {path.length}
          </p>
        </div>

        {/* Reading content */}
        <div
          className="flex-1 overflow-auto p-4 lg:p-8"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <article className="max-w-2xl mx-auto">
            <div className="prose prose-invert prose-lg">
              <div className="font-serif text-lg leading-relaxed whitespace-pre-wrap">
                {currentNode.content}
              </div>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              Written by {currentNode.author_username}
            </p>
          </article>
        </div>

        {/* Navigation and actions */}
        <div className="border-t border-gray-800 p-4">
          {/* Path navigation - mobile */}
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <button
              onClick={() => navigatePath('prev')}
              disabled={pathIndex === 0}
              className="btn btn-ghost"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-400">
              {pathIndex + 1} / {path.length}
            </span>
            <button
              onClick={() => navigatePath('next')}
              disabled={pathIndex >= path.length - 1}
              className="btn btn-ghost"
            >
              Next →
            </button>
          </div>

          {/* Branch selection */}
          {children.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">
                {children.length} branch{children.length > 1 ? 'es' : ''} available:
              </p>
              <div className="flex flex-wrap gap-2">
                {children.map((child, i) => (
                  <button
                    key={child.id}
                    onClick={() => selectBranch(child)}
                    className="btn btn-secondary text-sm"
                  >
                    Branch {i + 1} (by {child.author_username})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {user && children.length < story.max_branches && (
              <button
                onClick={() => setShowBranchForm(!showBranchForm)}
                className="btn btn-primary"
              >
                {showBranchForm ? 'Cancel' : '+ Add Branch'}
              </button>
            )}
            {user && (
              <button
                onClick={toggleCompleteVote}
                className={`btn ${hasVotedComplete ? 'btn-primary' : 'btn-secondary'}`}
              >
                {hasVotedComplete ? '✓ Marked Complete' : 'Mark as Complete'}
              </button>
            )}
            {!user && (
              <Link to="/login" className="btn btn-secondary">
                Login to contribute
              </Link>
            )}
          </div>

          {/* Branch form */}
          {showBranchForm && (
            <form onSubmit={submitBranch} className="mt-4">
              <textarea
                value={branchContent}
                onChange={(e) => setBranchContent(e.target.value)}
                className="input min-h-[200px] resize-y font-serif text-lg mb-2"
                placeholder="Continue the story..."
                required
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Branch'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
