import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  request: NextRequest, 
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params
    const { action, adminNotes } = await request.json()
    
    console.log("Admin approval request:", { requestId, action, adminNotes })
    
    return NextResponse.json({
      success: true,
      message: action === "approved" ? "승인되었습니다." : "거부되었습니다.",
      data: { requestId, action }
    })
  } catch (error) {
    console.error("Approval error:", error)
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." }, 
      { status: 500 }
    )
  }
}