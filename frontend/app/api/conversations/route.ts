import { fetchUserManyDetails } from '@/data/user';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const session = await MyLibUserAuth();

  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.id;

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized ID' }, { status: 401 });
  }

  try {
    const { title, participants } = await req.json();

    if (!participants || !Array.isArray(participants)) {
      return NextResponse.json({ message: 'Invalid participants' }, { status: 400 });
    }

    // Fetch users based on email or ID
    const participantData = await Promise.all(
      participants.map(async (participant) => {
        // Check if participant is an email or a user ID
        const user = await dbPrisma.user.findFirst({
          where: {
            OR: [
              { email: participant },
              { id: participant }
            ],
          },
          select: { id: true },
        });

        return user ? user.id : null;
      })
    );

    // Filter out any nulls (in case some participants were not found)
    const participantIds = participantData.filter((id): id is string => id !== null);

    // Ensure the current user is also included in the conversation
    const allParticipants = Array.from(new Set([...participantIds, userId]));

    if (allParticipants.length < 2) {
      return NextResponse.json({ message: 'No valid participants found' }, { status: 400 });
    }

    const conversation = await dbPrisma.conversation.create({
      data: {
        title,
        userId, // The user who creates the conversation
        participants: allParticipants,
      },
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ message: 'Error creating conversation', error: error.message }, { status: 500 });
  }
}

export async function GET() {
    const session = await MyLibUserAuth();
  
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  
    const userId = session.id;
  
    try {
      const conversations = await dbPrisma.conversation.findMany({
        where: {
          OR: [
            { userId },
            { participants: { has: userId } },
          ],
        },
        include: {
          messages: true,
          company: true,
          user: true,
        },
      });
  
      // Extract all participant IDs from all conversations
      const allParticipantIds = Array.from(
        new Set(conversations.flatMap((conversation) => conversation.participants as string[]))
      );
  
      // Fetch details for all participants
      const users = await fetchUserManyDetails(allParticipantIds);
  
      // Add participant details to each conversation
      const conversationsWithUserDetails = conversations.map((conversation) => {
        const participantDetails = (conversation.participants as string[]).map((id) =>
          users.find((user) => user.id === id)
        );
  
        return {
          ...conversation,
          participants: participantDetails, // Replace participant IDs with full user details
        };
      });
  
      return NextResponse.json(conversationsWithUserDetails, { status: 200 });
    } catch (error) {
      console.error('Error fetching conversations:', error);
  
      if (error instanceof Error) {
        return NextResponse.json({ message: 'Error fetching conversations', error: error.message }, { status: 500 });
      }
  
      return NextResponse.json({ message: 'Unknown error occurred' }, { status: 500 });
    }
  }