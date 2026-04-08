import type { LessonContentBlock } from "./content-blocks";
import { LessonImageHotspotsBlockRenderer } from './lesson-image-hotspots-block'

type Props = {
  blocks: LessonContentBlock[];
  className?: string;
};

export function ContentBlocksRenderer({ blocks, className }: Props) {
  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === "table") {
          return (
            <div
              key={`table-${index}`}
              className="my-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div
                className="table-content min-w-full"
                dangerouslySetInnerHTML={{ __html: block.content }}
              />
            </div>
          );
        }

        if (block.type === 'image-hotspots') {
          return (
            <LessonImageHotspotsBlockRenderer
              key={`image-hotspots-${index}`}
              content={block.content}
            />
          )
        }

        return (
          <div
            key={`rich-${index}`}
            className="lesson-rich-text"
            dangerouslySetInnerHTML={{ __html: block.content }}
          />
        );
      })}
    </div>
  );
}
