import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase, type Event } from '../lib/supabase';
import { cn } from '../lib/utils';

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    event?: Event | null;
    initialDate?: Date;
}

export default function EventModal({ isOpen, onClose, onSave, event, initialDate }: EventModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (event) {
            setTitle(event.title);
            setDescription(event.description || '');
            setStartTime(new Date(event.start_time).toISOString().slice(0, 16));
            setEndTime(event.end_time ? new Date(event.end_time).toISOString().slice(0, 16) : '');
        } else {
            setTitle('');
            setDescription('');
            const date = initialDate || new Date();
            const isoDate = date.toISOString().slice(0, 11) + '09:00'; // Default to 9 AM
            setStartTime(isoDate);
            setEndTime('');
        }
    }, [event, isOpen, initialDate]);

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        const eventData = {
            title,
            description,
            start_time: new Date(startTime).toISOString(),
            end_time: endTime ? new Date(endTime).toISOString() : null,
        };

        try {
            if (event?.id) {
                const { error } = await supabase
                    .from('events')
                    .update(eventData)
                    .eq('id', event.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('events')
                    .insert([eventData]);
                if (error) throw error;
            }
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving event:', error);
            alert('Erro ao salvar evento. Verifique o console.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                    <h3 className="text-xl font-bold text-slate-800">
                        {event ? 'Editar Evento' : 'Novo Evento'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Título</label>
                        <input
                            required
                            type="text"
                            className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                            placeholder="Ex: Reunião, Dentista..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Descrição</label>
                        <textarea
                            className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium resize-none h-24"
                            placeholder="Notas adicionais..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Início</label>
                            <input
                                required
                                type="datetime-local"
                                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Fim (Opcional)</label>
                            <input
                                type="datetime-local"
                                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            disabled={loading}
                            type="submit"
                            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {loading ? 'Salvando...' : 'Salvar Evento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
