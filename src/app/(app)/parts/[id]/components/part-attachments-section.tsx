"use client";

import { DrivePicker } from "@/components/drive-picker";
import { addPartAttachment, deletePartAttachment } from "../actions";

type Attachment = {
  id: string;
  drive_file_id: string;
  name: string;
  mime_type: string | null;
};

export function PartAttachmentsSection({
  partId,
  attachments,
}: {
  partId: string;
  attachments: Attachment[];
}) {
  return (
    <DrivePicker
      attachments={attachments}
      onAttach={async (file) =>
        addPartAttachment({
          part_id: partId,
          drive_file_id: file.drive_file_id,
          name: file.name,
          mime_type: file.mime_type,
        })
      }
      onDelete={async (id) => deletePartAttachment({ id, part_id: partId })}
    />
  );
}
