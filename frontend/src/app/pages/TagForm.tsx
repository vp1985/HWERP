import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { ArrowLeft, X, Save } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import { Tag, TagContext, TAG_COLORS } from '../types/tag';
import { uuid } from '../lib/utils';
import Tooltip from '../components/Tooltip';
import DevTooltip from '../components/DevTooltip';
import { useModalClose } from '../hooks/useModalClose';

export default function TagForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, dispatch, repository } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState<string>('');
  const [suggestedContexts, setSuggestedContexts] = useState<TagContext[]>([]);
  const [blockedContexts, setBlockedContexts] = useState<TagContext[]>([]);
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDirtyWarning, setShowDirtyWarning] = useState(false);

  const tags = (state.tags as Tag[]) || [];
  const isNew = !id;
  const existingTag = id ? tags.find((t) => t.id === id) : null;

  // Load tag data
  useEffect(() => {
    if (id) {
      if (existingTag) {
        setName(existingTag.name);
        setCode(existingTag.code || '');
        setColor(existingTag.color || '');
        setSuggestedContexts(existingTag.suggestedContexts || []);
        setBlockedContexts(existingTag.blockedContexts || []);
        setIsLoading(false);
      } else {
        navigate('/tags');
      }
    } else {
      setIsLoading(false);
    }
  }, [id, existingTag, navigate]);

  const handleNameChange = (value: string) => {
    setName(value);
    setIsDirty(true);
    if (errors.name) {
      setErrors({ ...errors, name: undefined });
    }
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
    setIsDirty(true);
    if (errors.code) {
      setErrors({ ...errors, code: undefined });
    }
  };

  const handleToggleContext = (context: TagContext, type: 'suggested' | 'blocked') => {
    setIsDirty(true);
    if (type === 'suggested') {
      setSuggestedContexts((prev) =>
        prev.includes(context)
          ? prev.filter((c) => c !== context)
          : [...prev, context]
      );
    } else {
      setBlockedContexts((prev) => {
        if (prev.includes(context)) {
          return prev.filter((c) => c !== context);
        } else {
          setSuggestedContexts((prevSug) => prevSug.filter((c) => c !== context));
          return [...prev, context];
        }
      });
    }
  };

  const allContexts: TagContext[] = ['ASSETS', 'MATERIALS', 'SERVICES', 'CALC_ITEMS'];

  const validate = (): boolean => {
    const newErrors: { name?: string; code?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Name ist erforderlich';
    } else {
      const duplicate = tags.find(
        (t) => t.name.toLowerCase() === name.trim().toLowerCase() && t.id !== id
      );
      if (duplicate) {
        newErrors.name = 'Tag existiert bereits';
      }
    }
    const trimmedCode = code.trim();
    if (trimmedCode) {
      if (/\s/.test(trimmedCode)) {
        newErrors.code = 'Code darf keine Leerzeichen enthalten';
      } else if (trimmedCode.length < 1 || trimmedCode.length > 10) {
        newErrors.code = 'Code muss zwischen 1 und 10 Zeichen lang sein';
      } else {
        const duplicate = tags.find(
          (t) => t.code && t.code.toLowerCase() === trimmedCode.toLowerCase() && t.id !== id
        );
        if (duplicate) {
          newErrors.code = 'Code existiert bereits';
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const trimmedCode = code.trim();
      const tagData: Tag = {
        id: id || uuid(),
        name: name.trim(),
        ...(trimmedCode && { code: trimmedCode }),
        color,
        suggestedContexts,
        blockedContexts,
        createdAt: existingTag?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const saved = await repository.upsert<Tag>('tags', tagData);
      if (isNew) {
        dispatch({ type: 'ADD_ENTITY', entity: 'tags', data: saved });
      } else {
        dispatch({ type: 'UPDATE_ENTITY', entity: 'tags', data: saved });
      }
      navigate('/tags');
    } catch (error) {
      console.error('Failed to save tag:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowDirtyWarning(true);
    } else {
      navigate('/tags');
    }
  };

  const confirmCancel = () => {
    navigate('/tags');
  };

  const handleCloseDirtyWarning = useCallback(() => setShowDirtyWarning(false), []);
  const handleDirtyWarningBackdropClick = useModalClose(showDirtyWarning, handleCloseDirtyWarning);

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Tag laden...</h1>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">
            {isNew ? 'Neuer Tag' : 'Tag bearbeiten'}
          </h1>
          <Link
            to="/tags"
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            <X size={24} />
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          {/* Name Field */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <Tooltip
                text="Name des Tags. Muss eindeutig sein (Gro\u00df-/Kleinschreibung spielt keine Rolle)."
                placement="right"
              />
            </div>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="z.B. Trafo, \u00d6l, Pr\u00fcfung"
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Code Field */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                Code (optional)
              </label>
              <Tooltip
                text="K\u00fcrzel f\u00fcr kompakte Ansichten (z.B. 'Tx' f\u00fcr 'Trafo'). Optional, aber wenn angegeben, muss es eindeutig sein."
                placement="right"
              />
            </div>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.code ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="z.B. Tx, \u00d6l, Pr\u00fcf"
            />
            {errors.code && (
              <p className="mt-1 text-sm text-red-600">{errors.code}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              1-10 Zeichen, keine Leerzeichen
            </p>
          </div>

          {/* Color Field */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Farbe (optional)
              </label>
              <Tooltip
                text="Farbe zur besseren visuellen Unterscheidung in der Benutzeroberfl\u00e4che."
                placement="right"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setColor(''); setIsDirty(true); }}
                className={`w-10 h-10 rounded-lg border-2 transition-all ${
                  !color ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300 hover:border-gray-400'
                } bg-gray-200`}
                title="Keine Farbe (Standard)"
              >
                {!color && <div className="text-center text-xs leading-10">\u2713</div>}
              </button>
              {TAG_COLORS.map((colorOption) => (
                <button
                  key={colorOption.hex}
                  type="button"
                  onClick={() => { setColor(colorOption.hex); setIsDirty(true); }}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    color === colorOption.hex ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: colorOption.hex }}
                  title={colorOption.name}
                >
                  {color === colorOption.hex && (
                    <div className="text-white text-center text-xs leading-10 font-bold">\u2713</div>
                  )}
                </button>
              ))}
            </div>
            {color && (
              <p className="mt-2 text-xs text-gray-500">
                Ausgew\u00e4hlt: {TAG_COLORS.find((c) => c.hex === color)?.name || 'Benutzerdefiniert'}
              </p>
            )}
          </div>

          {/* Suggested Contexts */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-700">Vorgeschlagen in</label>
              <DevTooltip
                text="Steuert nur die Reihenfolge/Prominenz im TagPicker (Empfehlungen). Tag bleibt grunds\u00e4tzlich ausw\u00e4hlbar."
                placement="right"
              />
            </div>
            <div className="space-y-2">
              {allContexts.map((context) => (
                <label key={context} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={suggestedContexts.includes(context)}
                    onChange={() => handleToggleContext(context, 'suggested')}
                    disabled={blockedContexts.includes(context)}
                    className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className={`text-sm ${blockedContexts.includes(context) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {context}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Blocked Contexts */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-700">Gesperrt in</label>
              <DevTooltip
                text="Tag kann in diesen Kontexten nicht gew\u00e4hlt werden (z.B. bestimmte Tags nur f\u00fcr Material, nicht f\u00fcr Assets)."
                placement="right"
              />
            </div>
            <div className="space-y-2">
              {allContexts.map((context) => (
                <label key={context} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={blockedContexts.includes(context)}
                    onChange={() => handleToggleContext(context, 'blocked')}
                    className="mr-2 h-4 w-4 text-red-600 rounded focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">{context}</span>
                </label>
              ))}
            </div>
            {blockedContexts.length > 0 && suggestedContexts.some((c) => blockedContexts.includes(c)) && (
              <p className="mt-2 text-xs text-orange-600">
                \u2139\ufe0f Gesperrte Kontexte werden automatisch aus "Vorgeschlagen in" entfernt.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSaving}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save size={20} />
              {isSaving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>

      {/* Dirty Warning Modal */}
      {showDirtyWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleDirtyWarningBackdropClick}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">\u00c4nderungen verwerfen?</h2>
            <p className="text-gray-600 mb-6">
              Sie haben ungespeicherte \u00c4nderungen. M\u00f6chten Sie wirklich abbrechen?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDirtyWarning(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Zur\u00fcck
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                \u00c4nderungen verwerfen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
