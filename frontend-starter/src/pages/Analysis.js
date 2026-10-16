
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
  useDisclosure,
  useToast,
  VStack,
  Divider,
} from '@chakra-ui/react';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiMessageSquare,
  FiCopy,
  FiCheck,
} from 'react-icons/fi';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
} from '../api';

const CATEGORIES = [
  'Greeting',
  'Order Support',
  'Refunds',
  'Escalation',
  'Closing',
  'General',
];

const EMPTY_FORM = {
  name: '',
  category: 'General',
  description: '',
  content: '',
  isActive: true,
  sharedWithTeam: false,
};

function getVariables(content = '') {
  return [
    ...new Set(
      [...content.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)]
        .map((match) => match[1])
    ),
  ];
}

function humanizeVariable(variable) {
  return variable
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function resolvePreview(content, values) {
  return content.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_, variable) => values[variable]?.trim() || `{{${variable}}}`
  );
}

const TemplateCard = ({
  template,
  onEdit,
  onDelete,
  onToggle,
  onUse,
}) => (
  <Box
    bg="white"
    border="1px solid"
    borderColor="gray.200"
    borderRadius="xl"
    p={5}
    shadow="sm"
    transition="all 0.2s"
    _hover={{ shadow: 'md', borderColor: 'purple.200' }}
  >
    <Flex justify="space-between" align="start" gap={3}>
      <Box minW={0}>
        <HStack mb={2} wrap="wrap">
          <Badge colorScheme="purple">{template.category}</Badge>
          <Badge colorScheme={template.isActive ? 'green' : 'gray'}>
            {template.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </HStack>
        <Heading size="md" noOfLines={2}>
          {template.name}
        </Heading>
      </Box>

      <HStack spacing={1}>
        <IconButton
          icon={<FiEdit2 />}
          aria-label="Edit template"
          size="sm"
          variant="ghost"
          onClick={() => onEdit(template)}
        />
        <IconButton
          icon={<FiTrash2 />}
          aria-label="Delete template"
          size="sm"
          variant="ghost"
          colorScheme="red"
          onClick={() => onDelete(template)}
        />
      </HStack>
    </Flex>

    <Text mt={3} fontSize="sm" color="gray.600" noOfLines={2}>
      {template.description || 'No description provided.'}
    </Text>

    <Box
      mt={4}
      p={3}
      bg="gray.50"
      borderRadius="md"
      minH="92px"
      maxH="120px"
      overflow="hidden"
    >
      <Text fontSize="sm" whiteSpace="pre-wrap">
        {template.content}
      </Text>
    </Box>

    <HStack mt={3} spacing={2} wrap="wrap">
      <Badge variant="outline">
        {getVariables(template.content).length} variables
      </Badge>
      <Badge variant="outline">
        Used {template.usageCount || 0} times
      </Badge>
    </HStack>

    <Divider my={4} />

    <Flex justify="space-between" align="center" gap={2}>
      <Checkbox
        isChecked={template.isActive}
        onChange={() => onToggle(template)}
        colorScheme="purple"
        size="sm"
      >
        Active
      </Checkbox>

      <Button
        size="sm"
        colorScheme="purple"
        leftIcon={<FiMessageSquare />}
        onClick={() => onUse(template)}
        isDisabled={!template.isActive}
      >
        Use template
      </Button>
    </Flex>
  </Box>
);

const Analysis = () => {
  const toast = useToast();
  const editor = useDisclosure();
  const resolver = useDisclosure();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variableValues, setVariableValues] = useState({});
  const [resolvedMessage, setResolvedMessage] = useState('');

  const variables = useMemo(
    () => getVariables(form.content),
    [form.content]
  );

  const selectedVariables = useMemo(
    () => getVariables(selectedTemplate?.content || ''),
    [selectedTemplate]
  );

  const preview = useMemo(
    () => resolvePreview(selectedTemplate?.content || '', variableValues),
    [selectedTemplate, variableValues]
  );

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getTemplates({ active: 'all' });
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        title: 'Could not load templates',
        description:
          error.response?.data?.message || 'Check that the backend is running.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    // Load once when the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesCategory =
        categoryFilter === 'All' || template.category === categoryFilter;

      const searchableText = [
        template.name,
        template.description,
        template.content,
        template.category,
      ]
        .join(' ')
        .toLowerCase();

      return matchesCategory && searchableText.includes(query);
    });
  }, [templates, search, categoryFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    editor.onOpen();
  };

  const openEdit = (template) => {
    setEditingId(template._id);
    setForm({
      name: template.name || '',
      category: template.category || 'General',
      description: template.description || '',
      content: template.content || '',
      isActive: template.isActive !== false,
      sharedWithTeam: Boolean(template.sharedWithTeam),
    });
    editor.onOpen();
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast({
        title: 'Name and message are required',
        status: 'warning',
        duration: 2500,
      });
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        await updateTemplate(editingId, form);
      } else {
        await createTemplate(form);
      }

      toast({
        title: editingId ? 'Template updated' : 'Template created',
        status: 'success',
        duration: 2500,
      });

      editor.onClose();
      await loadTemplates();
    } catch (error) {
      toast({
        title: 'Unable to save template',
        description: error.response?.data?.message || error.message,
        status: 'error',
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template) => {
    const confirmed = window.confirm(
      `Delete "${template.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteTemplate(template._id);
      setTemplates((previous) =>
        previous.filter((item) => item._id !== template._id)
      );
      toast({ title: 'Template deleted', status: 'success' });
    } catch (error) {
      toast({
        title: 'Could not delete template',
        description: error.response?.data?.message || error.message,
        status: 'error',
      });
    }
  };

  const handleToggle = async (template) => {
    try {
      const updated = {
        name: template.name,
        category: template.category,
        description: template.description || '',
        content: template.content,
        isActive: !template.isActive,
        sharedWithTeam: Boolean(template.sharedWithTeam),
      };

      await updateTemplate(template._id, updated);
      await loadTemplates();
      toast({
        title: updated.isActive ? 'Template activated' : 'Template deactivated',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Could not update template status',
        description: error.response?.data?.message || error.message,
        status: 'error',
      });
    }
  };

  const openResolver = (template) => {
    setSelectedTemplate(template);
    setVariableValues({});
    setResolvedMessage('');
    resolver.onOpen();
  };

  const handleResolve = async () => {
    try {
      const result = await applyTemplate(
        selectedTemplate._id,
        variableValues
      );

      setResolvedMessage(result.message);
      await loadTemplates();

      toast({
        title: 'Template variables resolved',
        description: 'Your message is ready to copy.',
        status: 'success',
        duration: 2500,
      });
    } catch (error) {
      const missing = error.response?.data?.missingVariables || [];
      toast({
        title: error.response?.data?.message || 'Could not resolve template',
        description: missing.length
          ? `Fill in: ${missing.join(', ')}`
          : error.message,
        status: 'warning',
        duration: 4000,
      });
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(resolvedMessage);
      toast({ title: 'Message copied', status: 'success' });
    } catch {
      toast({
        title: 'Clipboard unavailable',
        description: 'Select and copy the message manually.',
        status: 'info',
      });
    }
  };

  const totalUses = templates.reduce(
    (total, template) => total + (template.usageCount || 0),
    0
  );

  return (
    <Box p={{ base: 3, md: 6 }} maxW="1500px" mx="auto">
      <Flex
        justify="space-between"
        align={{ base: 'start', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        gap={4}
        mb={6}
      >
        <Box>
          <Text color="purple.600" fontWeight="semibold" fontSize="sm">
            CUSTOMER SERVICE WORKSPACE
          </Text>
          <Heading size="xl" mt={1}>Response Templates</Heading>
          <Text color="gray.600" mt={2}>
            Create consistent replies and personalize them with customer data.
          </Text>
        </Box>
        <Button
          colorScheme="purple"
          leftIcon={<FiPlus />}
          onClick={openCreate}
        >
          Create template
        </Button>
      </Flex>

      <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} mb={6}>
        <Box bg="white" border="1px solid" borderColor="gray.200" p={4} borderRadius="lg">
          <Text color="gray.500" fontSize="sm">Total templates</Text>
          <Heading size="lg" mt={1}>{templates.length}</Heading>
        </Box>
        <Box bg="white" border="1px solid" borderColor="gray.200" p={4} borderRadius="lg">
          <Text color="gray.500" fontSize="sm">Active templates</Text>
          <Heading size="lg" mt={1}>
            {templates.filter((template) => template.isActive).length}
          </Heading>
        </Box>
        <Box bg="white" border="1px solid" borderColor="gray.200" p={4} borderRadius="lg">
          <Text color="gray.500" fontSize="sm">Total uses</Text>
          <Heading size="lg" mt={1}>{totalUses}</Heading>
        </Box>
      </SimpleGrid>

      <Flex
        bg="white"
        p={4}
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
        gap={3}
        direction={{ base: 'column', md: 'row' }}
        mb={6}
      >
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxW={{ md: '420px' }}
        />
        <Select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          maxW={{ md: '240px' }}
        >
          <option value="All">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </Select>
        <Button
          variant="outline"
          leftIcon={<FiSearch />}
          onClick={loadTemplates}
        >
          Refresh
        </Button>
      </Flex>

      {loading ? (
        <Flex justify="center" py={16}>
          <Spinner size="xl" color="purple.500" />
        </Flex>
      ) : filteredTemplates.length === 0 ? (
        <Box bg="white" p={10} borderRadius="xl" textAlign="center">
          <Heading size="md">No templates found</Heading>
          <Text color="gray.600" mt={2}>
            Create a template or change your search filters.
          </Text>
          <Button mt={4} colorScheme="purple" onClick={openCreate}>
            Create your first template
          </Button>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={5}>
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template._id}
              template={template}
              onEdit={openEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onUse={openResolver}
            />
          ))}
        </SimpleGrid>
      )}

      {/* Create / edit modal */}
      <Modal isOpen={editor.isOpen} onClose={editor.onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingId ? 'Edit template' : 'Create response template'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Template name</FormLabel>
                <Input
                  value={form.name}
                  maxLength={100}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="e.g. Order delay apology"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Category</FormLabel>
                <Select
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Description</FormLabel>
                <Input
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="When should supervisors use this reply?"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Message content</FormLabel>
                <Textarea
                  value={form.content}
                  onChange={(event) =>
                    setForm({ ...form, content: event.target.value })
                  }
                  placeholder="Hi {{customer_name}}, your order {{order_id}} is being checked."
                  minH="140px"
                  maxLength={5000}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Use {'{{variable_name}}'} for dynamic values.
                </Text>
              </FormControl>

              <Box bg="purple.50" p={4} borderRadius="md">
                <Text fontWeight="semibold" mb={2}>Detected variables</Text>
                {variables.length ? (
                  <HStack wrap="wrap" spacing={2}>
                    {variables.map((variable) => (
                      <Badge key={variable} colorScheme="purple">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </HStack>
                ) : (
                  <Text fontSize="sm" color="gray.600">
                    No variables detected. Your template will use fixed text.
                  </Text>
                )}
              </Box>

              <Checkbox
                isChecked={form.isActive}
                onChange={(event) =>
                  setForm({ ...form, isActive: event.target.checked })
                }
                colorScheme="purple"
              >
                Make this template active
              </Checkbox>
              <Checkbox
  isChecked={Boolean(form.sharedWithTeam)}
  onChange={(event) =>
    setForm({
      ...form,
      sharedWithTeam: event.target.checked,
    })
  }
  colorScheme="purple"
>
  Share this template with the team
</Checkbox>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={editor.onClose}>Cancel</Button>
            <Button
              colorScheme="purple"
              onClick={handleSave}
              isLoading={saving}
            >
              {editingId ? 'Save changes' : 'Create template'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Variable substitution / usage modal */}
      <Modal isOpen={resolver.isOpen} onClose={resolver.onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Personalize response</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedTemplate && (
              <Stack spacing={4}>
                <Box>
                  <Badge colorScheme="purple">
                    {selectedTemplate.category}
                  </Badge>
                  <Heading size="md" mt={2}>
                    {selectedTemplate.name}
                  </Heading>
                  <Text color="gray.600" fontSize="sm" mt={1}>
                    Fill in the variables to create the final customer message.
                  </Text>
                </Box>

                {selectedVariables.length > 0 ? (
                  selectedVariables.map((variable) => (
                    <FormControl key={variable} isRequired>
                      <FormLabel>{humanizeVariable(variable)}</FormLabel>
                      <Input
                        value={variableValues[variable] || ''}
                        onChange={(event) =>
                          setVariableValues((previous) => ({
                            ...previous,
                            [variable]: event.target.value,
                          }))
                        }
                        placeholder={`Enter ${humanizeVariable(variable).toLowerCase()}`}
                      />
                    </FormControl>
                  ))
                ) : (
                  <Alert status="info" borderRadius="md">
                    <AlertIcon />
                    This template has no variables to fill in.
                  </Alert>
                )}

                <Box bg="gray.50" p={4} borderRadius="lg">
                  <Text fontWeight="semibold" mb={2}>Message preview</Text>
                  <Text whiteSpace="pre-wrap">{preview}</Text>
                </Box>

                {resolvedMessage && (
                  <Box bg="green.50" p={4} borderRadius="lg">
                    <HStack mb={2}>
                      <FiCheck />
                      <Text fontWeight="semibold">Resolved message</Text>
                    </HStack>
                    <Text whiteSpace="pre-wrap">{resolvedMessage}</Text>
                    <Button
                      mt={3}
                      size="sm"
                      variant="outline"
                      leftIcon={<FiCopy />}
                      onClick={copyMessage}
                    >
                      Copy message
                    </Button>
                  </Box>
                )}
              </Stack>
            )}
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={resolver.onClose}>Close</Button>
            <Button
              colorScheme="purple"
              onClick={handleResolve}
              isDisabled={
                selectedVariables.some(
                  (variable) => !variableValues[variable]?.trim()
                )
              }
            >
              Resolve variables
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Analysis;
