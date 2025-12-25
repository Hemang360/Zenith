import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export async function GET() {
  try {
    await dbConnect();
    const users = await User.find({ 
      isLooking: true,
      role: 'user'
    }).select('-__v');
    
    const formattedUsers = users.map(user => ({
      id: user._id ? user._id.toString() : null,
      uid: user.uid || null,
      name: user.name,
      email: user.email,
      profile_picture: user.profile_picture || null,
      bio: user.bio || null,
      github_link: user.github_link || null,
      linkedin_link: user.linkedin_link || null,
      portfolio_link: user.portfolio_link || null
    }));

    return NextResponse.json({ 
      users: formattedUsers, 
      status: "success" 
    });
  } catch (error) {
    console.error("Error fetching looking members:", error);
    return NextResponse.json(
      { 
        message: "Failed to fetch looking members", 
        error: String(error), 
        status: "error" 
      },
      { status: 500 }
    );
  }
}
