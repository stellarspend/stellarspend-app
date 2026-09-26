# Component Documentation

## UI Components Library

> Branch sync note: this documentation tweak is intentionally non-functional and only exists to create a visible diff for branch recognition.

### `Card`
A flexible card component with support for header, body, and footer slots.

#### Path
`components/ui/Card.tsx`

#### Components
- `Card`: Main container component
- `CardHeader`: Optional header section
- `CardBody`: Main content area
- `CardFooter`: Optional footer section

#### Props
- `className?: string` - Additional CSS classes
- `variant?: 'default' | 'outlined' | 'elevated'` - Visual style variant

#### Variants
- `default`: White background with subtle border
- `outlined`: Transparent background with prominent border
- `elevated`: White background with shadow, no border

#### Usage Example
```tsx
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card';

export function Example() {
  return (
    <Card variant="elevated" className="max-w-md">
      <CardHeader>
        <h2 className="text-xl font-bold">Card Title</h2>
      </CardHeader>
      <CardBody>
        <p>This is the main content of the card.</p>
      </CardBody>
      <CardFooter>
        <button>Action</button>
      </CardFooter>
    </Card>
  );
}
```

### `Grid`
A responsive grid layout component with flexible column configurations.

#### Path
`components/ui/Grid.tsx`

#### Props
- `className?: string` - Additional CSS classes
- `cols?: 1 | 2 | 3 | 4 | 6 | 12` - Number of columns (default: 1)
- `gap?: 'sm' | 'md' | 'lg' | 'xl'` - Spacing between grid items (default: 'md')
- `responsive?: { sm?, md?, lg?, xl? }` - Responsive column configuration per breakpoint

#### Usage Example
```tsx
import { Grid } from '@/components/ui/Grid';

export function Example() {
  return (
    <Grid 
      cols={1} 
      gap="lg"
      responsive={{ sm: 2, md: 3, lg: 4 }}
      className="w-full"
    >
      <div>Item 1</div>
      <div>Item 2</div>
      <div>Item 3</div>
      <div>Item 4</div>
    </Grid>
  );
}
```

### `Stack`
A flexible layout component for arranging items vertically or horizontally with consistent spacing.

#### Path
`components/ui/Stack.tsx`

#### Props
- `className?: string` - Additional CSS classes
- `direction?: 'horizontal' | 'vertical'` - Stack direction (default: 'vertical')
- `spacing?: 'sm' | 'md' | 'lg' | 'xl'` - Space between items (default: 'md')
- `align?: 'start' | 'center' | 'end' | 'stretch'` - Cross-axis alignment (default: 'stretch')
- `justify?: 'start' | 'center' | 'end' | 'between' | 'around'` - Main-axis alignment (default: 'start')

#### Usage Example
```tsx
import { Stack } from '@/components/ui/Stack';

export function Example() {
  return (
    <Stack direction="vertical" spacing="lg" align="center">
      <h1>Title</h1>
      <p>Description</p>
      <button>Action</button>
    </Stack>
  );
}
```

## Shared Hooks

### `useForm`
A reusable wrapper around `react-hook-form` and `zod` for consistent form handling and validation.

#### Path
`hooks/useForm.ts`

#### Features
- **Type-safe**: Leverages Zod schema inference for full TypeScript support.
- **Easy Validation**: Seamless integration of Zod validation rules.
- **Consistent API**: Returns standard React Hook Form handlers and state.

#### Usage Example
```tsx
import { z } from 'zod';
import { useForm } from '@/hooks/useForm';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  amount: z.coerce.number().positive(),
});

type FormData = z.infer<typeof schema>;

export function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    schema,
    defaultValues: { email: '', amount: 0 }
  });

  const onSubmit = (data: FormData) => console.log(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}
      
      <input type="number" {...register('amount')} />
      {errors.amount && <p>{errors.amount.message}</p>}
      
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Form Components

### `BudgetForm`
Located in `components/budgets/BudgetForm.tsx`. Used for creating and editing budgets.

### `GoalForm`
Located in `components/savings/GoalForm.tsx`. Used for setting savings goals with target amounts and deadlines.
