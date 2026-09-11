import { RoomLobby } from "@/features/rooms/room-lobby";

type PlayerRoomPageProps = {
  params: Promise<{ roomId: string }>;
};

const PlayerRoomPage = async ({ params }: PlayerRoomPageProps) => {
  const { roomId } = await params;
  return <RoomLobby roomId={roomId} />;
};

export default PlayerRoomPage;