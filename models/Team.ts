import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ITeam extends Document {
    teamCode: string;
    teamLead: Types.ObjectId;
    isLooking: boolean;
    teamMembers: Types.ObjectId[];
    teamStatus: 'submitted' | 'pending' | 'withdrawn';
    RSVP: boolean;
    appliedFor?: Types.ObjectId;
    isEvaluated: boolean;
    scores?: {
        tech: number;
        ux: number;
        presentation: number;
        total: number;
    };
    comments?: string;
    isShortlisted: boolean;
}

const TeamSchema: Schema = new Schema({
    teamCode: { type: String, required: true, unique: true },
    teamLead: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    isLooking: { type: Boolean, default: true },
    teamMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    teamStatus: {
        type: String,
        enum: ['submitted', 'pending', 'withdrawn'],
        default: 'pending'
    },
    RSVP: { type: Boolean, default: false },
    appliedFor: { type: Schema.Types.ObjectId, ref: 'ProblemStatement' },
    isEvaluated: { type: Boolean, default: false },
    scores: {
        tech: { type: Number },
        ux: { type: Number },
        presentation: { type: Number },
        total: { type: Number }
    },
    comments: { type: String },
    isShortlisted: { type: Boolean, default: false }
}, {
    timestamps: true,
});

const Team: Model<ITeam> = mongoose.models.Team || mongoose.model<ITeam>('Team', TeamSchema);

export default Team;
