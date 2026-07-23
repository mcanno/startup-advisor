import { auth } from "@clerk/nextjs/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getInterviewForUser, getReport } from "@/lib/db/queries";
import { ReportPdf } from "@/lib/report-pdf";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: interviewId } = await ctx.params;

  const interview = await getInterviewForUser(interviewId, userId);
  if (!interview) {
    return new Response("Not found", { status: 404 });
  }

  const report = await getReport(interviewId);
  if (!report) {
    return new Response("Report not found", { status: 404 });
  }

  const pdfBuffer = await renderToBuffer(
    ReportPdf({
      title: interview.title,
      report: report.content,
    }),
  );

  const filename = `informe-${interview.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "diagnostico"}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
