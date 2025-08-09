/**
 * UI Components Index
 * Motion Connect HR System Design System
 */

// Core Components
export { default as Button } from './Button';
export { default as Input } from './Input';
export { default as Card } from './Card';
export { default as Modal } from './Modal';
export { default as Toast } from './Toast';
export { default as Dropdown } from './Dropdown';

// Button variants
export {
  PrimaryButton,
  SecondaryButton,
  OutlineButton,
  GhostButton,
  TextButton,
  SubmitButton,
  CancelButton,
  ApproveButton,
  RejectButton,
  DeleteButton,
  SaveButton,
  EditButton,
  LoadingButton
} from './Button';

// Input variants
export {
  EmailInput,
  PasswordInput,
  NumberInput,
  TelInput,
  SearchInput,
  EmployeeIdInput,
  DepartmentInput,
  PositionInput,
  DateInput
} from './Input';

// Card variants
export {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatsCard,
  NotificationCard,
  EmployeeCard
} from './Card';

// Modal sub-components
export {
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter
} from './Modal';

// Toast utilities
export {
  ToastContainer,
  createToast,
  createSuccessToast,
  createErrorToast,
  createWarningToast,
  createInfoToast
} from './Toast';

// Dropdown sub-components
export {
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
  UserMenuDropdown
} from './Dropdown';

// Layout Components
export {
  Container,
  PageContainer,
  SectionContainer,
  DashboardContainer
} from '../layout/Container';

// Re-export types for convenience
export type {
  ButtonProps,
  InputProps,
  CardProps,
  ModalProps,
  ToastProps,
  DropdownProps,
  ContainerProps
} from '@/lib/design-system/types';