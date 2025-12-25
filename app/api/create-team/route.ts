import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Team from "@/models/Team";
import User from "@/models/User";

const generateTeamCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = Math.floor(Math.random() * 3) + 6;
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export async function POST(req: Request) {
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

    const existingTeam = await Team.findOne({
      $or: [{ teamLead: userId }, { teamMembers: userId }]
    });

    if (existingTeam) {
      return NextResponse.json(
        { message: "User already part of a team", status: "error" },
        { status: 409 }
      );
    }

    let teamCode: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      teamCode = generateTeamCode();
      const existingTeamWithCode = await Team.findOne({ teamCode });
      if (!existingTeamWithCode) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return NextResponse.json(
        { message: "Failed to generate unique team code", status: "error" },
        { status: 500 }
      );
    }

    const newTeam = await new Team({
      teamLead: userId,
      teamMembers: [],
      teamCode: teamCode!,
      isLooking: true,
      teamStatus: "pending"
    });
    await newTeam.save();

    return NextResponse.json({
      message: "Team created successfully",
      status: "success",
      team: {
        id: newTeam._id.toString(),
        teamCode: newTeam.teamCode,
        teamLead: newTeam.teamLead.toString(),
        membersCount: newTeam.teamMembers.length,
        islooking: newTeam.isLooking,
        teamStatus: newTeam.teamStatus
      }
    });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json(
      {
        message: "Failed to create team",
        error: String(error),
        status: "error"
      },
      { status: 500 }
    );
  }
}

