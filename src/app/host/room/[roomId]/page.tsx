import { RoomLobby } from "@/features/rooms/room-lobby";

type HostRoomPageProps = {
  params: Promise<{ roomId: string }>;
};

const HostRoomPage = async ({ params }: HostRoomPageProps) => {
  const { roomId } = await params;
  return <RoomLobby isHost roomId={roomId} />;
};

export default HostRoomPage;