import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Team from "@/models/Team";
import User from "@/models/User";

const MAX_TEAM_SIZE = 4;

export async function PUT(req: Request) {
  try {
    const { userId, teamCode } = await req.json();
    if (!userId || !teamCode) {
      return NextResponse.json(
        { message: "userId and teamCode are required", status: "error" },
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

    const existingTeam = await Team.findOne({
      $or: [{ teamLead: userId }, { teamMembers: userId }]
    });

    if (existingTeam) {
      return NextResponse.json(
        { message: "User already part of a team", status: "error" },
        { status: 409 }
      );
    }

    const team = await Team.findOne({ teamCode });
    if (!team) {
      return NextResponse.json(
        { message: "Team not found", status: "error" },
        { status: 404 }
      );
    }

    if (!team.isLooking) {
      return NextResponse.json(
        { message: "Team is not looking for new members", status: "error" },
        { status: 409 }
      );
    }

    if (team.teamStatus === "withdrawn") {
      return NextResponse.json(
        { message: "Team has been withdrawn", status: "error" },
        { status: 409 }
      );
    }

    if (team.teamLead.toString() === userId) {
      return NextResponse.json(
        { message: "User is already the team lead", status: "error" },
        { status: 409 }
      );
    }

    // Add user to team
    team.teamMembers.push(userId);

    // Auto-close team when full
    if (team.teamMembers.length >= MAX_TEAM_SIZE) {
      team.isLooking = false;
    }

    await team.save();

    return NextResponse.json({
      message: "Successfully joined team",
      status: "success",
      team: {
        teamCode: team.teamCode,
        membersCount: team.teamMembers.length,
        isLooking: team.isLooking,
        teamStatus: team.teamStatus
      }
    });
  } catch (error) {
    console.error("Error joining team:", error);
    return NextResponse.json(
      {
        message: "Failed to join team",
        error: String(error),
        status: "error"
      },
      { status: 500 }
    );
  }
}

