export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? 'world';

  return Response.json({
    ok: true,
    message: `hello ${name}`,
    time: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json({ received: body }, { status: 201 });
}
