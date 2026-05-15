"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PdfPreview({ quoteId }: { quoteId: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {visible ? (
          <>
            <EyeOff className="size-3.5" />
            Hide PDF preview
          </>
        ) : (
          <>
            <Eye className="size-3.5" />
            Show PDF preview
          </>
        )}
      </button>
      {visible && (
        <iframe
          src={`/api/quotes/${quoteId}/pdf`}
          className="w-full h-[700px] rounded-lg border mt-3"
          title="Quote PDF preview"
        />
      )}
    </div>
  );
}
