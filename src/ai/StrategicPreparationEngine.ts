/**
 * 🔒 PRIVACY NOTICE
 * All strategic preparation generation runs locally on device using deterministic logic.
 * No LLM calls. No external API calls. No data leaves this device.
 */

import { NegotiationMode, StrategicAnalysis, PreSessionInputs } from '../types/session';

export interface FormField {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'number' | 'multiline';
  required: boolean;
}

export class StrategicPreparationEngine {

  /**
   * Generates the required input fields based on the selected negotiation mode
   */
  public static getFormConfigForMode(mode: NegotiationMode): FormField[] {
    switch (mode) {
      case NegotiationMode.JOB_INTERVIEW:
        return [
          { id: 'role', label: 'Role applying for', placeholder: 'e.g. Senior Product Manager', type: 'text', required: true },
          { id: 'company_type', label: 'Company type', placeholder: 'Startup / MNC / Agency', type: 'text', required: true },
          { id: 'years_exp', label: 'Years of experience', placeholder: 'e.g. 5', type: 'number', required: true },
          { id: 'top_skills', label: 'Top 3 skills', placeholder: 'e.g. Python, Leadership, System Design', type: 'text', required: true },
          { id: 'achievement', label: 'Biggest measurable achievement', placeholder: 'e.g. Scaled revenue by 40%', type: 'multiline', required: true },
          { id: 'expected_salary', label: 'Expected salary', placeholder: 'e.g. $150,000', type: 'text', required: true },
          { id: 'weakness', label: 'Known weaknesses', placeholder: 'e.g. Lack of enterprise experience', type: 'multiline', required: false },
        ];
      case NegotiationMode.SALES:
        return [
          { id: 'product', label: 'Product/Service', placeholder: 'e.g. Enterprise SaaS Platform', type: 'text', required: true },
          { id: 'target_profile', label: 'Target customer profile', placeholder: 'e.g. CTOs at mid-market companies', type: 'text', required: true },
          { id: 'price_range', label: 'Price range', placeholder: 'e.g. $50k - $100k ARR', type: 'text', required: true },
          { id: 'objections', label: 'Known objections', placeholder: 'e.g. Too expensive, difficult integration', type: 'multiline', required: true },
          { id: 'competitors', label: 'Competitor names', placeholder: 'e.g. Salesforce, Oracle', type: 'text', required: false },
          { id: 'goal', label: 'Goal of call', placeholder: 'e.g. Schedule technical demo', type: 'text', required: true },
        ];
      case NegotiationMode.STARTUP_PITCH:
        return [
          { id: 'problem', label: 'Problem statement', placeholder: 'Describe the core problem in 1 sentence', type: 'multiline', required: true },
          { id: 'solution', label: 'Solution summary', placeholder: 'How do you fix it?', type: 'multiline', required: true },
          { id: 'traction', label: 'Traction metrics', placeholder: 'e.g. 10k MRR, 50% MoM growth', type: 'multiline', required: true },
          { id: 'revenue_model', label: 'Revenue model', placeholder: 'e.g. B2B Subscription', type: 'text', required: true },
          { id: 'funding_ask', label: 'Funding ask', placeholder: 'e.g. $2M Seed', type: 'text', required: true },
          { id: 'market_size', label: 'Target market size', placeholder: 'e.g. $10B TAM', type: 'text', required: true },
        ];
      case NegotiationMode.SALARY_RAISE:
        return [
          { id: 'current_role', label: 'Current role', placeholder: 'e.g. Marketing Director', type: 'text', required: true },
          { id: 'current_salary', label: 'Current salary', placeholder: 'e.g. $120,000', type: 'text', required: true },
          { id: 'market_salary', label: 'Market salary range', placeholder: 'e.g. $140,000 - $160,000', type: 'text', required: true },
          { id: 'achievements', label: 'Key achievements', placeholder: 'What did you do this year?', type: 'multiline', required: true },
          { id: 'manager_type', label: 'Manager personality type', placeholder: 'e.g. Analytical, Supportive, Strict', type: 'text', required: true },
          { id: 'desired_raise', label: 'Desired raise %', placeholder: 'e.g. 15%', type: 'text', required: true },
        ];
      case NegotiationMode.INVESTOR_MEETING:
        return [
          { id: 'fund_name', label: 'Fund Name', placeholder: 'e.g. Sequoia Capital', type: 'text', required: false },
          { id: 'fund_thesis', label: 'Fund Thesis/Focus', placeholder: 'e.g. Deeptech SaaS', type: 'text', required: false },
          { id: 'burn_rate', label: 'Current monthly burn', placeholder: 'e.g. $50k/mo', type: 'text', required: true },
          { id: 'runway', label: 'Months of runway left', placeholder: 'e.g. 6 months', type: 'number', required: true },
          { id: 'valuation_cap', label: 'Target Valuation Cap', placeholder: 'e.g. $15M Post-Money', type: 'text', required: true },
          { id: 'weakness', label: 'Biggest risk to thesis', placeholder: 'e.g. High churn rate', type: 'multiline', required: true },
        ];
      case NegotiationMode.CLIENT_NEGOTIATION:
        return [
          { id: 'client_name', label: 'Client / Company Name', placeholder: 'e.g. Acme Corp', type: 'text', required: true },
          { id: 'project_scope', label: 'Project Scope', placeholder: 'Briefly describe the deliverables', type: 'multiline', required: true },
          { id: 'timeline', label: 'Proposed Timeline', placeholder: 'e.g. 3 Months', type: 'text', required: true },
          { id: 'budget', label: 'Client Budget (if known)', placeholder: 'e.g. $25k', type: 'text', required: false },
          { id: 'leverage', label: 'Your Leverage', placeholder: 'Why do they need YOU specifically?', type: 'multiline', required: true },
        ];
      case NegotiationMode.CUSTOM_SCENARIO:
      default:
        return [
          { id: 'scenario_desc', label: 'Describe the scenario', placeholder: 'Who are you talking to and what do you want?', type: 'multiline', required: true },
          { id: 'your_goal', label: 'Your ultimate goal', placeholder: 'What is a "win" for you?', type: 'text', required: true },
          { id: 'their_goal', label: 'Their likely goal', placeholder: 'What do they want out of this?', type: 'text', required: true },
          { id: 'leverage', label: 'Your Leverage', placeholder: 'What advantages do you hold?', type: 'multiline', required: true },
          { id: 'risks', label: 'Biggest Risk / Weakness', placeholder: 'What are you afraid they will bring up?', type: 'multiline', required: false },
        ];
    }
  }

  /**
   * Deterministically generates the 10-point Strategic Analysis plan completely offline
   */
  public static generateStrategicAnalysis(mode: NegotiationMode, inputs: PreSessionInputs): StrategicAnalysis {
    console.log(`[StrategicPreparationEngine] Generating analysis for ${mode}...`);
    
    // Base template
    const analysis: StrategicAnalysis = {
      powerPositioning: '',
      likelyObjections: [],
      psychologicalTactics: [],
      recommendedResponses: [],
      highImpactPhrases: [],
      phrasesToAvoid: [],
      confidenceTriggers: [],
      openingScript: '',
      closingScript: '',
      mistakesToAvoid: [],
    };

    switch (mode) {
      case NegotiationMode.JOB_INTERVIEW:
        analysis.powerPositioning = `Position yourself not as an applicant, but as a peer evaluating a mutual fit. Your anchor is your achievement: ${inputs.achievement || 'your strong track record'}. Leverage your ${inputs.years_exp || '*'} years of experience as proof of execution risk reduction for the ${inputs.company_type || 'company'}.`;
        
        analysis.likelyObjections = [
          `"We are looking for someone with more experience in [Specific Niche]."`,
          `"Your salary expectation of ${inputs.expected_salary || 'this range'} is above our current band."`,
          inputs.weakness ? `"Can you explain your background regarding ${inputs.weakness}?"` : `"Are you comfortable operating outside your core skillset?"`
        ];
        
        analysis.psychologicalTactics = [
          'The Pause: They may stay silent after you answer to force you to over-explain. Do not fill the silence.',
          'The Low Anchor: Suggesting a title or compensation lower than market to test your boundary.',
          'Pressure Testing: Deliberately challenging your achievements to see if you get defensive.'
        ];
        
        analysis.recommendedResponses = [
          `If they challenge your weakness: "That is an area I'm actively bridging, but my core strength in ${inputs.top_skills?.split(',')[0] || 'execution'} allows me to drive results while I adapt quickly."`,
          `If they press on salary early: "I'd prefer to ensure I'm the perfect fit for the ${inputs.role || 'role'} before we lock in compensation. Does that work for you?"`,
          `If they offer a low anchor: "Based on the market rate for ${inputs.years_exp || 'my'} years of experience and the scope of this role, my floor is higher than that."`
        ];
        
        analysis.highImpactPhrases = [
          '"I drove...", "I implemented...", "The measurable outcome was..."',
          '"My thesis for this role is..."',
          '"How does this role directly impact top-line revenue?"'
        ];
        
        analysis.phrasesToAvoid = [
          '"I think...", "I believe...", "I feel like..."',
          '"I was part of a team that..." (Use "I led" or "I owned")',
          '"I really need this job."'
        ];
        
        analysis.confidenceTriggers = [
          'Maintain 3 seconds of eye contact when stating your achievement.',
          'Keep your hands visible on the table (if in person or deep frame video).',
          'Drop your vocal pitch slightly at the end of sentences to convey authority.'
        ];
        
        analysis.openingScript = `"It's great to connect. I've been following [Company]'s recent moves, and I'm excited to explore how my background in ${inputs.top_skills?.split(',')[0] || 'my field'} can help accelerate your goals for this quarter."`;
        
        analysis.closingScript = `"Based on our conversation, I'm confident I can execute on [Their Core Metric]. What timelines should I expect for next steps so I can align my other conversations?"`;
        
        analysis.mistakesToAvoid = [
          'Revealing your current salary (it caps your future salary).',
          'Rambling for more than 90 seconds on a single answer.',
          'Asking logistical questions (hours, vacation) before an offer is extended.'
        ];
        break;

      case NegotiationMode.SALARY_RAISE:
        analysis.powerPositioning = `You are presenting a business case, not a personal plea. You are a highly-performing asset (${inputs.current_role || 'in your role'}) seeking market alignment. Your request of ${inputs.desired_raise || 'a raise'} is justified by the ROI you provided: ${inputs.achievements || 'your recent contributions'}.`;
        
        analysis.likelyObjections = [
          `"The budget is frozen until next quarter."`,
          `"You are already at the top of the band for your title."`,
          `"We need to see more leadership before we can authorize a ${inputs.desired_raise || 'raise'} jump."`
        ];
        
        analysis.psychologicalTactics = [
          'Sympathy Play: "I really wish I could, but my hands are tied by HR/Finance." (Authority Pressure)',
          'The Delay: "Let\'s circle back to this during annual reviews in 6 months." (Deflection)',
          'The Guilt Trip: "Times are tough for the team right now." (Negative Signal)'
        ];
        
        analysis.recommendedResponses = [
          `If budget is frozen: "If base compensation is locked, are we able to explore an off-cycle bonus structure or equity grant tied to my recent ${inputs.achievements?.substring(0,20) || 'successes'}?"`,
          `If deferred to later: "To ensure we have a productive conversation then, can we put in writing the exact metrics required to unlock the ${inputs.market_salary || 'market'} range?"`,
          `If given a hard no: "I appreciate the transparency. For me to continue operating at peak capacity, I need a clear pathway to market-rate compensation. How can we build that?"`
        ];
        
        analysis.highImpactPhrases = [
          '"Market alignment," "Value capture," "Data shows..."',
          '"Based on the scope of my current contributions..."',
          '"My priority is continuing to drive value here."'
        ];
        
        analysis.phrasesToAvoid = [
          '"I need the money for [personal reason]."',
          '"I haven\'t had a raise in X years." (Focus on value, not time)',
          '"If I don\'t get this, I will quit." (Never issue ultimatums unless you have an offer in hand)'
        ];
        
        analysis.confidenceTriggers = [
          'Bring physical data: Have a printed sheet or shared screen showing the market data and your achievements.',
          'Silence after the ask. State your number, then stop talking.',
          'Maintain a collaborative, non-combative posture.'
        ];
        
        analysis.openingScript = `"Thank you for taking the time to meet. The purpose of this sync is to review my recent contributions—specifically ${inputs.achievements?.substring(0,30) || 'my recent wins'}—and discuss aligning my compensation with both my current output and the market rate."`;
        
        analysis.closingScript = `"I appreciate your time going over this. I’ll send a summary email outlining the milestones we discussed to reach the ${inputs.market_salary || 'target'} band by [Date]."`;
        
        analysis.mistakesToAvoid = [
          'Apologizing for asking for money.',
          'Getting visibly emotional or defensive if rejected.',
          'Negotiating against yourself before they even respond.'
        ];
        break;

      case NegotiationMode.SALES:
        analysis.powerPositioning = `You are a high-value consultant diagnosing a painful problem, not a vendor pushing a product. Your ${inputs.product || 'solution'} is the antidote to the friction plaguing their ${inputs.target_profile || 'team'}. Control the frame by asking diagnostic questions.`;
        
        analysis.likelyObjections = [
          inputs.objections || `"Your solution is too expensive for our current budget."`,
          inputs.competitors ? `"We are already looking at ${inputs.competitors.split(',')[0]} and they are cheaper."` : `"We are satisfied with our current manual process."`,
          `"This isn't a priority for this quarter."`
        ];
        
        analysis.psychologicalTactics = [
          'The Silent Treatment: Letting you pitch into the void to drain your confidence and make you offer discounts.',
          'Phantom Authority: Pretending they have decision power to extract information, then claiming they need to "run it by the boss." (Authority Pressure)',
          'Commoditization: Comparing your complex solution to a basic feature to drive down the price.'
        ];
        
        analysis.recommendedResponses = [
          `If they claim it's too expensive: "Expensive compared to what? What is the current cost of doing nothing for another 6 months?"`,
          `If they mention competitors: "We respect ${inputs.competitors?.split(',')[0] || 'them'}. They are great for basic needs. Our clients choose us when they need [Your Unique Value Proposition]."`,
          `If urgency is low: "I hear you. If we pause this until next quarter, how will you handle the fallout from [Specific Pain Point] in the meantime?"`
        ];
        
        analysis.highImpactPhrases = [
          '"What happens if you do nothing?"',
          `"Typically, ${inputs.target_profile || 'leaders'} in your position tell me..."`,
          '"Is it fair to say..." (Calibrated question)'
        ];
        
        analysis.phrasesToAvoid = [
          '"Just checking in / following up..." (Provides zero value)',
          '"To be honest with you..." (Implies you weren\'t honest before)',
          '"Does that make sense?" (Can sound patronizing)'
        ];
        
        analysis.confidenceTriggers = [
          'Mirroring: Repeat the last 1-3 words of their sentence to encourage them to elaborate without you asking a question.',
          'Slow your cadence down by 20%.',
          'Use downward inflection at the end of statements to project certainty.'
        ];
        
        analysis.openingScript = `"I appreciate you carving out time. My goal today isn't to pitch you ${inputs.product || 'our product'}—it's to determine if we are a fit. Are you open to me asking a few targeted questions about how you're currently handling [Problem Area]?"`;
        
        analysis.closingScript = `"Based on what you've shared about [Their Pain Point], I believe there is a strong fit. To ensure we respect your time, are you the sole decision-maker for the ${inputs.price_range || 'allocated'} budget, or should we include anyone else on the next ${inputs.goal || 'demo'}?"`;
        
        analysis.mistakesToAvoid = [
          'Pitching features instead of diagnosing pain.',
          'Answering unasked objections out of nervousness.',
          'Ending the call without a concrete commitment for the next step on the calendar.'
        ];
        break;

      // ... Add similar logic branches for Startup Pitch, Investor Meeting, Client, and Custom
      // Default to Custom logic if unhandled
      default:
        analysis.powerPositioning = `Root your frame in absolute certainty. You have leverage because ${inputs.leverage || 'you bring unique value'}. Do not enter the conversion from a defensive posture; you are exploring a mutual exchange of value.`;
        
        analysis.likelyObjections = [
          inputs.risks || `"I don't think we can accommodate that request."`,
          `"This requires further review from other stakeholders."`,
          `"We need to see a timeline shift to make this viable."`
        ];
        
        analysis.psychologicalTactics = [
          'Anchoring: Opening with an extreme position to drag the midpoint in their favor.',
          'Time Restraints: "I only have 5 minutes." (Rushing you into poor decisions).',
          'Flinching: Visibly acting shocked at your proposal to induce guilt.'
        ];
        
        analysis.recommendedResponses = [
          `If they flinch: Remain completely silent. Do not justify your position until they articulate a specific argument.`,
          `If they claim lack of authority: "Who else needs to be involved, and can we get them on the line now?"`,
          `To protect your goal of ${inputs.your_goal || 'success'}: "If we cannot agree on this, what is your proposed alternative that still solves my core requirement?"`
        ];
        
        analysis.highImpactPhrases = [
          '"It sounds like [Their goal] is a priority for you..." (Labeling)',
          '"How am I supposed to do that?" (The ultimate deferral question)',
          '"Let\'s put a pin in that and address [Your Priority] first."'
        ];
        
        analysis.phrasesToAvoid = [
          '"I\'m sorry but...", "I hope...", "I\'ll try..."',
          '"Is that okay with you?" (Weak framing)',
          'Any nervous laughter.'
        ];
        
        analysis.confidenceTriggers = [
          'Use Late-Night FM DJ Voice: Deep, slow, calming inflection.',
          'Take up physical space. Do not cross arms or shrink posture.',
          'Embrace the awkward silence after you make a demand.'
        ];
        
        analysis.openingScript = `"I'm glad we could connect. My objective today is to find a pathway to ${inputs.your_goal || 'our mutual goal'}, while addressing your need for ${inputs.their_goal || 'efficiency'}. Are you open to exploring the variables on the table?"`;
        
        analysis.closingScript = `"We've covered significant ground. To formalize this, I will draft a summary emphasizing how we leverage ${inputs.leverage?.substring(0, 20) || 'our mutual assets'}. Let's target [Date] of next week for finalizing signatures."`;
        
        analysis.mistakesToAvoid = [
          'Speaking first after laying a major proposal on the table.',
          'Conceding a variable without demanding something in return.',
          'Letting the opponent dictate the agenda.'
        ];
        break;
    }

    console.log('[StrategicPreparationEngine] Analysis generated successfully.');
    return analysis;
  }
}
