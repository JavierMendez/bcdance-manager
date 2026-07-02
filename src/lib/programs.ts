export type SerializedProgram = {
	id: number;
	name: string;
	description: string;
};

export type SerializedProgramWithUsage = SerializedProgram & {
	classCount: number;
};

export type ProgramFormValues = {
	name: string;
	description: string;
};

export function validateProgramInput(data: ProgramFormValues) {
	const errors: Record<string, string> = {};
	const name = data.name.trim();
	const description = data.description.trim();

	if (!name) {
		errors.name = 'El nombre es obligatorio.';
	}

	if (!description) {
		errors.description = 'La descripción es obligatoria.';
	}

	return {
		errors,
		values: { name, description }
	};
}

export function toProgramFormValues(program: SerializedProgram): ProgramFormValues {
	return {
		name: program.name,
		description: program.description
	};
}
