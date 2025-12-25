import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Team from "@/models/Team";
import User from "@/models/User";

const MAX_TEAM_SIZE = 4;

export async function PUT(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { message: "userId is required", status: "error" },
        { status: 400 }
      );
    }

    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      return NextResponse.json(
        { message: "Invalid userId format", status: "error" },
        { status: 400 }
      );
    }
    await dbConnect();
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { message: "User not found", status: "error" },
        { status: 404 }
      );
    }
    const team = await Team.findOne({ teamMembers: userId });
    if (!team) {
      return NextResponse.json(
        { message: "User is not part of any team", status: "error" },
        { status: 404 }
      );
    }
    if (team.teamLead.toString() === userId) {
      return NextResponse.json(
        { message: "Team lead cannot leave team", status: "error" },
        { status: 409 }
      );
    }

    const wasClosed = !team.isLooking;

    // Remove user from team
    team.teamMembers = team.teamMembers.filter(
      member => member.toString() !== userId
    );

    // Reopen team if space is available
    if (wasClosed && team.teamMembers.length < MAX_TEAM_SIZE) {
      team.isLooking = true;
    }

    await team.save();

    return NextResponse.json({
      message: "Successfully left team",
      status: "success",
      team: {
        teamCode: team.teamCode,
        membersCount: team.teamMembers.length,
        isLooking: team.isLooking,
        teamStatus: team.teamStatus
      }
    });
  } catch (error) {
    console.error("Error leaving team:", error);
    return NextResponse.json(
      {
        message: "Failed to leave team",
        error: String(error),
        status: "error"
      },
      { status: 500 }
    );
  }
}
