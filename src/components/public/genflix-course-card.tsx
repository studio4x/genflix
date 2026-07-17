import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CourseCoverMedia } from '@/components/public/course-cover-media';
import type { GenflixCourseItem } from '@/features/public/genflix-public-types';
export function GenflixCourseCard({ course, }: {
    course: GenflixCourseItem;
}) {
    const courseHref = `/cursos/${course.slug}`;
    const cardAuthorName = course.cardAuthorName || course.mentor;
    const cardAuthorDescription = course.cardAuthorDescription || course.role;
    const categoryCount = course.categories?.length ?? 0;
    const primaryCategory = course.categories?.[0] ?? course.category;
    const displayCategory = primaryCategory || 'Curso';
    const categoryLabel = categoryCount > 1 ? `${displayCategory} +${categoryCount - 1}` : displayCategory;
    return (<article className="group flex h-full flex-col overflow-hidden rounded-[4px] border border-[#D8E6EB] border-b-[4px] border-b-[#1C7082] bg-[#F2F8FA] shadow-[0_20px_50px_rgba(10,54,64,0.08)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_28px_64px_rgba(10,54,64,0.12)]">
      <Link to={courseHref} aria-label={`Abrir ${course.title}`} className="relative block aspect-[4/3] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7082] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F2F8FA]">
        <CourseCoverMedia src={course.image} alt={course.title} title={course.title} category={displayCategory} initials={course.initials} imageClassName="transition-transform duration-500 group-hover:scale-[1.03]" placeholderClassName="transition-transform duration-500 group-hover:scale-[1.03]"/>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,54,64,0.04)_0%,rgba(10,54,64,0)_38%,rgba(10,54,64,0.24)_100%)]"/>
        <div className="absolute left-4 top-4 rounded-full border border-emerald-300/80 bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-[0_6px_18px_rgba(5,150,105,0.35)]">
          {categoryLabel}
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-4 py-5">
        <div className="flex items-start gap-4">
          <h3 className="flex-1 text-[18px] font-semibold leading-[1.35] tracking-[-0.02em] text-[#15323B]">
            <Link to={courseHref} className="transition-colors duration-200 hover:text-[#1C7082] focus:outline-none focus-visible:rounded-[3px] focus-visible:ring-2 focus-visible:ring-[#1C7082] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F2F8FA]">
              {course.title}
            </Link>
          </h3>
          <Link to={`/cursos/${course.slug}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1C7082] text-white shadow-[0_4px_4px_rgba(0,0,0,0.12)] transition-transform duration-200 group-hover:translate-x-0.5" aria-label={`Abrir ${course.title}`}>
            <ArrowUpRight className="h-3 w-3"/>
          </Link>
        </div>

        <div className="mt-5 border-t border-[#D8E6EB] pt-4">
          <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-5 text-[#15323B]">{cardAuthorName}</p>
              <p className="line-clamp-3 text-[11px] leading-[1.45] text-[#60737A]">{cardAuthorDescription}</p>
          </div>
        </div>
      </div>
    </article>);
}
