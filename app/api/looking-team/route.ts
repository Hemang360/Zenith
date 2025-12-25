import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Team from "@/models/Team";

export async function GET() {
  try {
    await dbConnect();
    const teams = await Team.find({ 
      islooking: true,
      teamStatus: { $ne: 'withdrawn' }
    }).select('-__v');
    const formattedTeams = teams.map(team => ({
      id: team._id.toString(),
      teamCode: team.teamCode,
      teamLead: team.teamLead,
      membersCount: team.teamMembers.length,
      teamStatus: team.teamStatus,
      appliedFor: team.appliedFor || null
    }));

    return NextResponse.json({ 
      teams: formattedTeams, 
      status: "success" 
    });
  } catch (error) {
    console.error("Error fetching looking teams:", error);
    return NextResponse.json(
      { 
        message: "Failed to fetch looking teams", 
        error: String(error), 
        status: "error" 
      },
      { status: 500 }
    );
  }
}
