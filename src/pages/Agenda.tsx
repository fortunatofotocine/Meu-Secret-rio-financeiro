import React, { useState, useEffect } from 'react';
import { supabase, type Event } from '../lib/supabase';
import { ChevronLeft, ChevronRight, Plus, Clock, CheckCircle2, Circle, Trash2, Edit2 } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import EventModal from '../components/EventModal';

export default function Agenda() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  useEffect(() => {
    fetchEvents();
  }, [currentMonth]);

  async function fetchEvents() {
    setLoading(true);
    const start = startOfMonth(currentMonth).toISOString();
    const end = endOfMonth(currentMonth).toISOString();

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('start_time', start)
      .lte('start_time', end)
      .order('start_time', { ascending: true });

    if (data) setEvents(data);
    setLoading(false);
  }

  async function handleToggleComplete(event: Event) {
    const { error } = await supabase
      .from('events')
      .update({ completed: !event.completed })
      .eq('id', event.id);

    if (!error) {
      fetchEvents();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este compromisso?')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (!error) fetchEvents();
  }

  function handleEdit(event: Event) {
    setEditingEvent(event);
    setIsModalOpen(true);
  }

  function handleAdd() {
    setEditingEvent(null);
    setIsModalOpen(true);
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const selectedDateEvents = events.filter(e => isSameDay(new Date(e.start_time), selectedDate));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Agenda</h2>
          <p className="text-slate-500">Organize seus compromissos e tarefas.</p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          Novo Evento
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendar Card */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-xl text-slate-800 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells for padding */}
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {days.map(day => {
              const dayEvents = events.filter(e => isSameDay(new Date(e.start_time), day));
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all group",
                    isSelected ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "hover:bg-indigo-50 text-slate-700",
                    !isSameMonth(day, currentMonth) && "opacity-20"
                  )}
                >
                  <span className={cn(
                    "text-sm font-bold",
                    isTodayDate && !isSelected && "text-indigo-600"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {dayEvents.slice(0, 3).map((_, i) => (
                        <div key={i} className={cn(
                          "w-1 h-1 rounded-full",
                          isSelected ? "bg-white" : "bg-indigo-400"
                        )} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Events */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-lg text-slate-800">
                {isToday(selectedDate) ? 'Hoje' : format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </h3>
              <p className="text-xs text-slate-500">{selectedDateEvents.length} compromissos</p>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {selectedDateEvents.length > 0 ? (
              selectedDateEvents.map((event) => (
                <div key={event.id} className="group p-4 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        "font-bold text-slate-800 truncate",
                        event.completed && "line-through text-slate-400"
                      )}>
                        {event.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {format(new Date(event.start_time), 'HH:mm')}
                        {event.end_time && ` - ${format(new Date(event.end_time), 'HH:mm')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => handleEdit(event)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleComplete(event)}
                        className={cn(
                          "p-1.5 rounded-lg transition-all",
                          event.completed ? "text-emerald-500" : "text-slate-300 hover:text-indigo-600 hover:bg-white"
                        )}
                      >
                        {event.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {event.description && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{event.description}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <CalendarIcon className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-sm text-slate-400 font-medium">Nenhum evento para este dia.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchEvents}
        event={editingEvent}
        initialDate={selectedDate}
      />
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
