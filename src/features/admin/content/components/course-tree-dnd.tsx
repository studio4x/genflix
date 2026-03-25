import { Link, useLocation, useParams } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { 
  type AdminCourseTree, 
  reorderModules, 
  reorderLessons, 
  toErrorMessage 
} from '../api'

interface CourseTreeDndProps {
  tree: AdminCourseTree
  onRefresh: () => Promise<void>
}

export function CourseTreeDnd({ tree, onRefresh }: CourseTreeDndProps) {
  const { courseId } = useParams<{ courseId: string }>()
  const location = useLocation()
  const coursePath = `/admin/cursos/${courseId}/builder`
  const isCourseHome = location.pathname === coursePath

  async function onDragEnd(result: DropResult) {
    const { destination, source, type } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    try {
      if (type === 'module') {
        const newOrder = Array.from(tree.modules)
        const [removed] = newOrder.splice(source.index, 1)
        newOrder.splice(destination.index, 0, removed)
        
        // Update DB
        await reorderModules(courseId!, newOrder.map(m => m.id))
      } else {
        const sourceModule = tree.modules.find(m => `module-lessons-${m.id}` === source.droppableId)
        if (!sourceModule) return

        const newLessonOrder = Array.from(sourceModule.lessons)
        const [removed] = newLessonOrder.splice(source.index, 1)
        newLessonOrder.splice(destination.index, 0, removed)

        // Update DB
        await reorderLessons(sourceModule.id, newLessonOrder.map(l => l.id))
      }
      
      // Refresh tree to sync state
      await onRefresh()
    } catch (err) {
      alert(toErrorMessage(err))
    }
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex-1 overflow-y-auto w-full no-scrollbar p-3 space-y-1">
        
        {/* Course Root */}
        <Link 
          to={coursePath} 
          className={`group flex items-center justify-between p-2.5 rounded-lg text-sm transition-colors ${isCourseHome ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-100 shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className={`p-1.5 rounded-md ${isCourseHome ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm'}`}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <span className="truncate">Visão Geral do Curso</span>
          </div>
        </Link>

        {/* Modules List */}
        <Droppable droppableId="modules" type="module">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
              {tree.modules.map((m, mIdx) => (
                <Draggable key={m.id} draggableId={m.id} index={mIdx}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={snapshot.isDragging ? 'z-50' : ''}
                    >
                      <div className="group pt-2">
                        <div className={`flex items-center rounded-lg transition-colors ${location.pathname.includes(`/modulos/${m.id}`) && !location.pathname.includes('/aulas/') ? 'bg-slate-100 border border-slate-200 shadow-sm' : 'hover:bg-slate-100/50'}`}>
                          
                          {/* Drag Handle */}
                          <div {...provided.dragHandleProps} className="p-2 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                          </div>

                          <Link 
                            to={`/admin/cursos/${courseId}/builder/modulos/${m.id}`}
                            className="flex-1 p-2 py-2.5 text-sm font-bold text-slate-800 truncate"
                          >
                             <div className="flex items-center gap-2 truncate">
                               <div className="w-5 text-center text-[10px] font-extrabold text-slate-400">M{mIdx+1}</div>
                               <span className="truncate">{m.title}</span>
                             </div>
                          </Link>
                        </div>

                        {/* Lessons List Inside Module */}
                        <div className="ml-9 mt-1 space-y-0.5 border-l-2 border-slate-100 pl-2">
                          <Droppable droppableId={`module-lessons-${m.id}`} type={`lesson-${m.id}`}>
                            {(provided) => (
                              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-0.5">
                                {m.lessons.map((l, lIdx) => {
                                  const isActiveLesson = location.pathname.includes(`/aulas/${l.id}`)
                                  return (
                                    <Draggable key={l.id} draggableId={l.id} index={lIdx}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          className={`flex items-center group/lesson rounded-md transition-colors ${isActiveLesson ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'} ${snapshot.isDragging ? 'z-50 bg-white shadow-lg ring-1 ring-blue-100' : ''}`}
                                        >
                                          {/* Drag Handle */}
                                          <div {...provided.dragHandleProps} className="p-1 px-1.5 text-slate-200 group-hover/lesson:text-slate-400 cursor-grab active:cursor-grabbing">
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                                          </div>

                                          <Link
                                            to={`/admin/cursos/${courseId}/builder/modulos/${m.id}/aulas/${l.id}`}
                                            className="flex-1 py-1.5 px-1 rounded-md text-[13px] font-medium truncate"
                                          >
                                            <div className="flex items-center gap-2 truncate">
                                               {l.lesson_type === 'video' ? (
                                                 <svg className={`h-3.5 w-3.5 shrink-0 ${isActiveLesson ? 'text-blue-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                               ) : (
                                                 <svg className={`h-3.5 w-3.5 shrink-0 ${isActiveLesson ? 'text-blue-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                               )}
                                               <span className={`truncate ${isActiveLesson ? 'font-bold' : ''}`}>{l.title}</span>
                                            </div>
                                          </Link>
                                        </div>
                                      )}
                                    </Draggable>
                                  )
                                })}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>

                          {/* Quizzes (Fixed position for now, not draggable in this version or could be added) */}
                          {m.assessments.map(a => {
                            const isActiveAssessment = location.pathname.includes(`/avaliacoes/${a.id}`)
                            return (
                              <div key={a.id} className={`flex items-center group/quiz rounded-md transition-colors ${isActiveAssessment ? 'bg-amber-50 text-amber-700 border border-amber-100 shadow-sm' : 'hover:bg-amber-50/30'}`}>
                                <div className="p-1 px-1.5 text-transparent">
                                   <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                                </div>
                                <Link
                                  to={`/admin/cursos/${courseId}/builder/modulos/${m.id}/avaliacoes/${a.id}`}
                                  className="flex-1 py-1.5 px-1 text-[13px] font-medium truncate"
                                >
                                   <div className="flex items-center gap-2 truncate">
                                     <svg className={`h-3.5 w-3.5 shrink-0 ${isActiveAssessment ? 'text-amber-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                     <span className={`truncate ${isActiveAssessment ? 'font-bold' : ''}`}>{a.title}</span>
                                   </div>
                                </Link>
                              </div>
                            )
                          })}
                          
                          {/* Add Lesson/Quiz quick actions */}
                          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link to={`/admin/cursos/${courseId}/builder/modulos/${m.id}/aulas/nova`} className="flex-1 flex items-center gap-1.5 py-1 px-1.5 rounded-md text-[11px] font-bold text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                              Aula
                            </Link>
                            <Link to={`/admin/cursos/${courseId}/builder/modulos/${m.id}/avaliacoes/nova`} className="flex-1 flex items-center gap-1.5 py-1 px-1.5 rounded-md text-[11px] font-bold text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                              Quiz
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* Add Module Quick Action */}
        <div className="pt-4 pb-2">
           <Link to={`/admin/cursos/${courseId}/builder/modulos/novo`} className="flex items-center gap-2 p-3 rounded-xl text-sm font-black text-blue-600 border border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-100 transition-all">
              <div className="bg-blue-600 text-white p-1 rounded-md">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              </div>
              Novo Módulo
           </Link>
        </div>
      </div>
    </DragDropContext>
  )
}
