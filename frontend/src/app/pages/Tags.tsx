import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { Search, Plus, Edit2, Trash2 } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import { Tag, TagContext } from '../types/tag';
import TagBadge from '../components/TagBadge';
import { useModalClose } from '../hooks/useModalClose';

export default function Tags() {
  const { state, dispatch, repository } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Load tags on mount
  useEffect(() => {
    async function loadTags() {
      try {
        const tags = await repository.list<Tag>('tags');
        dispatch({ type: 'SET_ENTITIES', entity: 'tags', data: tags });
      } catch (error) {
        console.error('Failed to load tags:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadTags();
  }, [repository, dispatch]);

  const tags = (state.tags as Tag[]) || [];

  // Filter tags by search query (name or code)
  const filteredTags = tags.filter((tag) => {
    const query = searchQuery.toLowerCase();
    return (
      tag.name.toLowerCase().includes(query) ||
      (tag.code && tag.code.toLowerCase().includes(query))
    );
  });

  const handleCloseDeleteConfirm = useCallback(() => setDeleteConfirm(null), []);
  const handleDeleteBackdropClick = useModalClose(!!deleteConfirm, handleCloseDeleteConfirm);

  const handleDelete = async (id: string) => {
    try {
      await repository.delete('tags', id);
      dispatch({ type: 'DELETE_ENTITY', entity: 'tags', id });
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete tag:', error);
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Helper: Zeige Context-Chips kompakt
  const renderContextChips = (contexts: TagContext[] | undefined) => {
    if (!contexts || contexts.length === 0) {
      return <span className="text-gray-400">—</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {contexts.map((ctx) => (
          <span
            key={ctx}
            className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
          >
            {ctx}
          </span>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Tags</h1>
        <p className="text-gray-600">Laden...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Tags</h1>
        <Link
          to="/tags/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Neuer Tag
        </Link>
      </div>

      {tags.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-600 mb-4">Noch keine Tags</p>
          <Link
            to="/tags/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Ersten Tag anlegen
          </Link>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="mb-6 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Tags durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">
                    Name
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">
                    Code
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">
                    Vorgeschlagen in
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">
                    Gesperrt in
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">
                    Aktualisiert
                  </th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-gray-700">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTags.length > 0 ? (
                  filteredTags.map((tag) => (
                    <tr key={tag.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <TagBadge tag={tag} size="md" />
                      </td>
                      <td className="px-6 py-4">
                        {tag.code ? (
                          <TagBadge tag={tag} size="md" showCode={true} />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {renderContextChips(tag.suggestedContexts)}
                      </td>
                      <td className="px-6 py-4">
                        {renderContextChips(tag.blockedContexts)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(tag.updatedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/tags/${tag.id}`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Bearbeiten"
                          >
                            <Edit2 size={18} />
                          </Link>
                          <button
                            onClick={() =>
                              setDeleteConfirm({ id: tag.id, name: tag.name })
                            }
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Löschen"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : searchQuery ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-600">
                      Keine Tags gefunden für "{searchQuery}"
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleDeleteBackdropClick}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Tag löschen?</h2>
            <p className="text-gray-600 mb-6">
              Möchten Sie den Tag "<strong>{deleteConfirm.name}</strong>" wirklich löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
