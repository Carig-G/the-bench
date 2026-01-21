import db from './config.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

async function seed() {
  console.log('Seeding database...\n');

  // Create test users
  const users = [
    { username: 'alice', password: 'password123' },
    { username: 'bob', password: 'password123' },
    { username: 'charlie', password: 'password123' },
    { username: 'dana', password: 'password123' },
  ];

  const userIds: Record<string, number> = {};

  for (const user of users) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username) as { id: number } | undefined;

    if (existing) {
      userIds[user.username] = existing.id;
      console.log(`User ${user.username} already exists (id: ${existing.id})`);
    } else {
      const hash = await bcrypt.hash(user.password, SALT_ROUNDS);
      const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(user.username, hash);
      userIds[user.username] = result.lastInsertRowid as number;
      console.log(`Created user ${user.username} (id: ${result.lastInsertRowid})`);
    }
  }

  // Sample conversations with realistic content
  const sampleConversations = [
    {
      creator: 'alice',
      title: 'Why do we find comfort in routine when adventure seems more exciting?',
      topic: 'Philosophy',
      description: 'Exploring the tension between our desire for novelty and our need for stability.',
      openingMessage: `I've been thinking about this paradox lately. We romanticize spontaneity and adventure - travel, new experiences, breaking out of our comfort zones. Social media is full of "quit your job and travel the world" content.

But when I'm honest with myself, some of my happiest moments come from pure routine: my morning coffee ritual, my Sunday evening walks, knowing exactly what to expect from my Wednesday nights.

Is our attraction to routine just evolutionary programming for safety? Or is there something genuinely fulfilling about it that our culture undervalues?

I'd love to explore this with someone who's thought about the tension between comfort and growth.`,
      status: 'matching' as const,
      responder: null,
    },
    {
      creator: 'bob',
      title: 'The podcast that changed how I think about creativity',
      topic: 'Podcasts & Ideas',
      description: null,
      openingMessage: `I recently finished binging "The Creative Act" conversations with Rick Rubin, and I can't stop thinking about one idea he keeps returning to: that creativity isn't about making something from nothing, but about noticing what's already there.

He talks about how the best artists are really just better observers - they pay attention to things the rest of us miss. And that this skill can be cultivated through practice.

What struck me is how this reframes creative block. It's not that you've run out of ideas - it's that you've stopped paying attention. The ideas are always there, flowing past like a river. You just need to learn to dip your cup in.

Has anyone else encountered an idea that completely shifted how you think about creativity or work? I'm curious what other mental models people have found useful.`,
      status: 'active' as const,
      responder: 'charlie',
      response: `This resonates deeply. I had a similar shift from a completely different source - actually from a woodworking teacher of all people.

He used to say "the wood already knows what it wants to become, your job is to listen." I thought it was pretentious nonsense at first. But the more I worked with him, the more I understood. You don't impose a design on material - you work with the grain, the natural patterns, the imperfections.

I've started applying this to my writing. Instead of forcing an outline, I'll write freely and then look for what's already emerging. The connections are usually already there - I just wasn't seeing them.

The Rubin idea about observation being the skill is interesting. Do you think some people are naturally better at noticing, or is it purely practice?`,
    },
    {
      creator: 'dana',
      title: 'What made you change your mind about something important?',
      topic: 'Changing Minds',
      description: 'I want to understand the actual experience of updating beliefs.',
      openingMessage: `I used to believe that people rarely change their minds about important things - that we just find new ways to justify what we already believe.

Then I changed my mind about that.

The experience that shifted me: I spent three years absolutely certain that remote work was inferior to in-office work. I had all the arguments: spontaneous collaboration, culture building, mentorship, etc.

Then the pandemic forced me to actually try it for an extended period. And slowly, reluctantly, I started noticing the evidence against my position. Deep work was easier. My team was actually MORE connected because we had to be intentional about it. The people who thrived weren't who I expected.

It took about 18 months before I could admit I'd been wrong. The process was uncomfortable - I kept finding ways to preserve my original belief even as evidence mounted.

I'm curious about other people's experiences of genuine belief change. What made you actually update? How did it feel?`,
      status: 'matching' as const,
      responder: null,
    },
    {
      creator: 'charlie',
      title: 'Is ambition overrated?',
      topic: 'Contrarian Ideas',
      description: null,
      openingMessage: `Hot take: I think our culture massively overvalues ambition, and it's making people miserable.

We treat ambition as an unalloyed virtue. Ambitious people are "driven," "motivated," "going places." People who are content with what they have are seen as somehow lacking - settling, coasting, not reaching their potential.

But what if contentment is actually the skill worth cultivating?

Some of the happiest people I know have modest jobs they're good at, strong relationships, hobbies they enjoy, and zero interest in climbing any ladders. They're not depressed or stuck - they've just opted out of the status game.

Meanwhile, the most ambitious people I know are often anxious, comparing themselves to others, never satisfied, always moving the goalpost.

I'm not saying ambition is bad. But I wonder if we've got the ratio wrong. Maybe a little ambition and a lot of contentment is better than the reverse.

Convince me I'm wrong?`,
      status: 'active' as const,
      responder: 'alice',
      response: `I want to push back, but not in the direction you might expect.

I don't think ambition and contentment are opposites. The framing sets up a false dichotomy.

What you're describing as "ambition" sounds more like status-seeking or comparison-driven striving. That's exhausting, I agree. But ambition can also be about curiosity - wanting to see what you're capable of, wanting to build something meaningful, wanting to master a craft.

The happiest ambitious people I know aren't trying to win - they're trying to explore. They're ambitious about the work itself, not about where the work positions them relative to others.

Similarly, contentment isn't the same as complacency. You can be content with who you are while still wanting to grow. Content with your baseline while still finding joy in the stretch.

The problem isn't ambition. The problem is when ambition comes from insecurity rather than genuine interest. Does this distinction resonate at all?`,
      secondResponse: `That distinction does resonate, and I think you've identified something I was conflating.

The ambitious people who seem miserable to me ARE the status-driven ones. They're not chasing mastery or curiosity - they're chasing titles, salaries, recognition. And it's never enough because the goalpost is always "what does the next person have?"

But I know a ceramicist who works 60-hour weeks perfecting her glazes. I wouldn't call her discontent. She's ambitious about the work but not anxious about her position.

So maybe my real claim is narrower: status-seeking ambition is overrated, and we often confuse it for the healthier kind.

Though I still wonder - can you cleanly separate them in practice? Even when I pursue something out of genuine interest, there's usually SOME part of me thinking about how it will be received, who will be impressed, what it means for my identity...`,
    },
  ];

  for (const conv of sampleConversations) {
    // Check if this conversation already exists (by title)
    const existing = db.prepare('SELECT id FROM conversations WHERE title = ?').get(conv.title);
    if (existing) {
      console.log(`Conversation "${conv.title.substring(0, 40)}..." already exists, skipping`);
      continue;
    }

    const creatorId = userIds[conv.creator];

    // Create conversation
    const convResult = db.prepare(`
      INSERT INTO conversations (title, topic, description, creator_id, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(conv.title, conv.topic, conv.description, creatorId, conv.status);

    const conversationId = convResult.lastInsertRowid as number;

    // Add creator as participant
    db.prepare(`
      INSERT INTO conversation_participants (conversation_id, user_id, role)
      VALUES (?, ?, 'initiator')
    `).run(conversationId, creatorId);

    // Add opening message (public)
    db.prepare(`
      INSERT INTO messages (conversation_id, author_id, content, is_public, message_order)
      VALUES (?, ?, ?, 1, 0)
    `).run(conversationId, creatorId, conv.openingMessage);

    // Add to matching queue if status is 'matching'
    if (conv.status === 'matching') {
      db.prepare(`
        INSERT INTO matching_queue (user_id, conversation_id, topic, description, matched)
        VALUES (?, ?, ?, ?, 0)
      `).run(creatorId, conversationId, conv.topic, conv.description);
    }

    // If there's a responder, add them and their messages
    if (conv.responder && conv.response) {
      const responderId = userIds[conv.responder];

      // Add responder as participant
      db.prepare(`
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        VALUES (?, ?, 'responder')
      `).run(conversationId, responderId);

      // Add response message (public - it's the 2nd message)
      db.prepare(`
        INSERT INTO messages (conversation_id, author_id, content, is_public, message_order)
        VALUES (?, ?, ?, 1, 1)
      `).run(conversationId, responderId, conv.response);

      // If there's a second response from creator (private - 3rd message)
      if ('secondResponse' in conv && conv.secondResponse) {
        db.prepare(`
          INSERT INTO messages (conversation_id, author_id, content, is_public, message_order)
          VALUES (?, ?, ?, 0, 2)
        `).run(conversationId, creatorId, conv.secondResponse);
      }
    }

    console.log(`Created conversation: "${conv.title.substring(0, 50)}..." (${conv.status})`);
  }

  console.log('\nSeeding complete!');
  console.log('\nTest accounts (all passwords: "password123"):');
  console.log('  - alice');
  console.log('  - bob');
  console.log('  - charlie');
  console.log('  - dana');
}

seed().catch(console.error);
